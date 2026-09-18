import type { RateLimitResult } from "../security/rate-limit-policy.ts";
import { mutationGuard, readJsonBody } from "../security/request.ts";

export type AdminLoginDependencies = {
  hashIp: (request: Request) => string | null;
  checkRateLimit: (input: { key: string; ipHash: string; max: number }) => Promise<RateLimitResult>;
  verifyCredentials: (email: string, password: string) => boolean;
};

export type AdminLoginResult =
  | { ok: true; email: string }
  | { ok: false; response: Response };

export async function evaluateAdminLogin(
  request: Request,
  dependencies: AdminLoginDependencies,
): Promise<AdminLoginResult> {
  const blocked = mutationGuard(request);
  if (blocked) return { ok: false, response: blocked };
  const body = await readJsonBody(request);
  if (!body.ok) return { ok: false, response: body.response };
  const record = body.value && typeof body.value === "object"
    ? body.value as Record<string, unknown>
    : {};
  const email = typeof record.email === "string" ? record.email : "";
  const password = typeof record.password === "string" ? record.password : "";
  if (!email || !password || password.length > 256) {
    return {
      ok: false,
      response: Response.json({ error: "Email o password non corretti." }, { status: 401 }),
    };
  }

  let ipHash: string | null = null;
  try {
    ipHash = dependencies.hashIp(request);
  } catch {
    ipHash = null;
  }
  if (!ipHash) {
    return {
      ok: false,
      response: Response.json({ error: "Servizio non disponibile." }, { status: 503 }),
    };
  }
  const rate = await dependencies.checkRateLimit({ key: "admin-login", ipHash, max: 10 });
  if (!rate.allowed) {
    const headers = rate.status === 429
      ? { "Retry-After": String(rate.retryAfter ?? 3600) }
      : undefined;
    return {
      ok: false,
      response: Response.json({ error: rate.error }, { status: rate.status, headers }),
    };
  }
  if (!dependencies.verifyCredentials(email, password)) {
    return {
      ok: false,
      response: Response.json({ error: "Email o password non corretti." }, { status: 401 }),
    };
  }
  return { ok: true, email };
}

export function requireAdminSession(authenticated: boolean): Response | null {
  return authenticated
    ? null
    : Response.json({ error: "Non autorizzato." }, { status: 401 });
}
