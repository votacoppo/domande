export type RateLimitInput = { key: string; ipHash: string; max: number };

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; status: 429 | 503; error: string; retryAfter?: number };

export type RateLimitRpc = (
  input: RateLimitInput,
  signal: AbortSignal,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const SERVICE_ERROR: RateLimitResult = {
  allowed: false,
  status: 503,
  error: "Servizio temporaneamente non disponibile.",
};

export async function runRateLimitCheck(
  input: RateLimitInput,
  rpc: RateLimitRpc,
  timeoutMs = 5_000,
): Promise<RateLimitResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("RATE_LIMIT_TIMEOUT"));
    }, timeoutMs);
  });
  try {
    const { data, error } = await Promise.race([rpc(input, controller.signal), timeout]);
    if (error) return SERVICE_ERROR;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return SERVICE_ERROR;
    const result = row as { allowed?: unknown; retry_after_seconds?: unknown };
    if (result.allowed === true) return { allowed: true };
    if (result.allowed !== false) return SERVICE_ERROR;
    const retryAfter = Number(result.retry_after_seconds);
    if (!Number.isFinite(retryAfter) || retryAfter < 1) return SERVICE_ERROR;
    return {
      allowed: false,
      status: 429,
      error: "Troppe richieste da questo indirizzo. Riprova fra un’ora.",
      retryAfter: Math.ceil(retryAfter),
    };
  } catch {
    return SERVICE_ERROR;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
