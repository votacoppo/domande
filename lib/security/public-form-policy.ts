import type { RateLimitResult } from "./rate-limit-policy.ts";

const MIN_FILL_MS = 3_000;

export type PublicGuardResult =
  | { ok: true; ipHash: string }
  | { ok: false; status: number; error: string; silent?: boolean; retryAfter?: number };

export type PublicGuardDependencies = {
  now?: () => number;
  hashIp: (request: Request) => string | null;
  verifyCaptcha: (token: string, request: Request) => Promise<{ ok: true } | { ok: false; status: 403 | 503 }>;
  checkRateLimit: (input: { key: string; ipHash: string; max: number }) => Promise<RateLimitResult>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function verifyPublicSubmission(
  request: Request,
  record: Record<string, unknown>,
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
    return { ok: false, status: 503, error: "Servizio temporaneamente non disponibile." };
  }
  if (!ipHash) {
    return { ok: false, status: 503, error: "Servizio temporaneamente non disponibile." };
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

  const rate = await dependencies.checkRateLimit({ key: "question-submit", ipHash, max: 10 });
  if (!rate.allowed) {
    return {
      ok: false,
      status: rate.status,
      error: rate.error,
      retryAfter: rate.retryAfter,
    };
  }
  return { ok: true, ipHash };
}
