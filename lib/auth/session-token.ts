import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = { email: string; expiresAt: number; epoch: string };

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function buildSessionToken(input: {
  email: string;
  secret: string;
  epoch: string;
  now?: number;
  ttlMs?: number;
}): string {
  if (input.secret.length < 32 || !input.epoch) throw new Error("Configurazione sessione non valida");
  const now = input.now ?? Date.now();
  const payload = Buffer.from(JSON.stringify({
    email: input.email.trim().toLowerCase(),
    expiresAt: now + (input.ttlMs ?? 7 * 24 * 60 * 60 * 1000),
    epoch: input.epoch,
  })).toString("base64url");
  return `${payload}.${sign(payload, input.secret)}`;
}

export function readSessionToken(input: {
  token: string;
  secret: string;
  epoch: string;
  expectedEmail: string;
  now?: number;
}): SessionPayload | null {
  if (input.secret.length < 32 || !input.epoch) return null;
  const [payload, signature, ...extra] = input.token.split(".");
  if (!payload || !signature || extra.length) return null;
  const expected = sign(payload, input.secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (parsed.email !== input.expectedEmail.trim().toLowerCase()) return null;
    if (parsed.epoch !== input.epoch || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= (input.now ?? Date.now())) return null;
    return parsed;
  } catch {
    return null;
  }
}
