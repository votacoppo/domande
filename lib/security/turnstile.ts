import { TURNSTILE_ACTION } from "../config.ts";
import { extractTrustedClientIp } from "./ip.ts";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export type TurnstileResult =
  | { ok: true }
  | { ok: false; status: 403 | 503 };

type TurnstileDependencies = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function expectedHostnames(): Set<string> {
  return new Set(
    (process.env.TURNSTILE_EXPECTED_HOSTNAMES ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function verifyTurnstile(
  token: string,
  request: Request,
  dependencies: TurnstileDependencies = {},
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const hosts = expectedHostnames();
  const ip = extractTrustedClientIp(request);
  const trimmed = token.trim();
  if (!secret || hosts.size === 0 || !ip) return { ok: false, status: 503 };
  if (!trimmed || trimmed.length > 2048) return { ok: false, status: 403 };

  const body = new URLSearchParams({ secret, response: trimmed, remoteip: ip });
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const requestPromise = (dependencies.fetchImpl ?? fetch)(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("TURNSTILE_TIMEOUT"));
      }, dependencies.timeoutMs ?? 7_000);
    });
    const response = await Promise.race([requestPromise, timeoutPromise]);
    if (!response.ok) return { ok: false, status: 503 };
    const data = (await response.json()) as TurnstileResponse;
    const valid = Boolean(
      data.success &&
        data.action === TURNSTILE_ACTION &&
        data.hostname &&
        hosts.has(data.hostname.toLowerCase()),
    );
    return valid ? { ok: true } : { ok: false, status: 403 };
  } catch {
    return { ok: false, status: 503 };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
