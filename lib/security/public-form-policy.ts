import { NETWORK_QUESTION_LIMIT, NETWORK_QUESTION_WINDOW_SECONDS } from "../config.ts";
import { formatWait, type QuestionSettings } from "../question-settings.ts";
import type { RateLimitInput, RateLimitResult } from "./rate-limit-policy.ts";

const MIN_FILL_MS = 3_000;
const SERVICE_UNAVAILABLE = "Servizio temporaneamente non disponibile.";

export type PublicGuardResult =
  | { ok: true; ipHash: string }
  | { ok: false; status: number; error: string; silent?: boolean; retryAfter?: number };

export type PublicGuardDependencies = {
  now?: () => number;
  hashIp: (request: Request) => string | null;
  verifyCaptcha: (token: string, request: Request) => Promise<{ ok: true } | { ok: false; status: 403 | 503 }>;
  checkRateLimit: (input: RateLimitInput) => Promise<RateLimitResult>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function blocked(rate: Extract<RateLimitResult, { allowed: false }>, message: (wait: string) => string): PublicGuardResult {
  if (rate.status !== 429) return { ok: false, status: rate.status, error: rate.error };
  return {
    ok: false,
    status: 429,
    error: message(formatWait(rate.retryAfter ?? NETWORK_QUESTION_WINDOW_SECONDS)),
    retryAfter: rate.retryAfter,
  };
}

export async function verifyPublicSubmission(
  request: Request,
  record: Record<string, unknown>,
  context: { deviceHash: string; settings: QuestionSettings },
  dependencies: PublicGuardDependencies,
): Promise<PublicGuardResult> {
  if (text(record._gotcha) || text(record.website)) {
    return { ok: false, status: 200, error: "", silent: true };
  }
  const loadedAt = Number(record.formLoadedAt);
  const now = dependencies.now?.() ?? Date.now();
  if (!Number.isFinite(loadedAt) || loadedAt <= 0 || now - loadedAt < MIN_FILL_MS) {
    return { ok: false, status: 400, error: "Attendi qualche secondo e riprova." };
  }

  let ipHash: string | null = null;
  try {
    ipHash = dependencies.hashIp(request);
  } catch {
    return { ok: false, status: 503, error: SERVICE_UNAVAILABLE };
  }
  if (!ipHash) {
    return { ok: false, status: 503, error: SERVICE_UNAVAILABLE };
  }

  const captcha = await dependencies.verifyCaptcha(text(record.turnstileToken), request);
  if (!captcha.ok) {
    return {
      ok: false,
      status: captcha.status,
      error: captcha.status === 503
        ? "Servizio anti-spam temporaneamente non disponibile."
        : "Verifica anti-spam non superata. Ricarica la pagina e riprova.",
    };
  }

  // Prima il limite per telefono: un dispositivo già bloccato non deve consumare
  // anche il tetto condiviso dalla rete della sala.
  const { deviceLimitMax, deviceLimitWindowSeconds } = context.settings;
  if (deviceLimitMax !== null) {
    const device = await dependencies.checkRateLimit({
      key: "question-device",
      identifier: context.deviceHash,
      max: deviceLimitMax,
      windowSeconds: deviceLimitWindowSeconds,
    });
    if (!device.allowed) {
      const noun = deviceLimitMax === 1 ? "domanda" : "domande";
      return blocked(device, (wait) =>
        `Hai già inviato ${deviceLimitMax} ${noun}: potrai mandarne un’altra tra ${wait}.`);
    }
  }

  const network = await dependencies.checkRateLimit({
    key: "question-submit",
    identifier: ipHash,
    max: NETWORK_QUESTION_LIMIT,
    windowSeconds: NETWORK_QUESTION_WINDOW_SECONDS,
  });
  if (!network.allowed) {
    return blocked(network, (wait) =>
      `Da questa rete sono arrivate troppe domande. Riprova tra ${wait}.`);
  }
  return { ok: true, ipHash };
}
