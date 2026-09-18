import "server-only";
import { cookies } from "next/headers";
import { buildSessionToken, readSessionToken, type SessionPayload } from "./session-token";

export const ADMIN_COOKIE = "marcello_qea_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const value = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET non configurato");
  return value;
}

function epoch(): string {
  const value = process.env.ADMIN_SESSION_EPOCH?.trim();
  if (!value) throw new Error("ADMIN_SESSION_EPOCH non configurato");
  return value;
}

export function createSessionToken(email: string, now = Date.now()): string {
  return buildSessionToken({ email, now, ttlMs: SESSION_TTL_MS, secret: sessionSecret(), epoch: epoch() });
}

export function parseSessionToken(token: string, now = Date.now()): SessionPayload | null {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expectedEmail) return null;
  return readSessionToken({ token, now, expectedEmail, secret: sessionSecret(), epoch: epoch() });
}

export async function hasAdminSession(): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get(ADMIN_COOKIE)?.value;
    return Boolean(token && parseSessionToken(token));
  } catch {
    return false;
  }
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
