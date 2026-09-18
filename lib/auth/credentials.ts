import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  if (password.length < 14) throw new Error("La password deve avere almeno 14 caratteri");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex, ...extra] = stored.split(":");
  if (!salt || !expectedHex || extra.length || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const storedHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!expectedEmail || !storedHash) return false;
  const normalized = email.trim().toLowerCase();
  const emailA = Buffer.from(normalized);
  const emailB = Buffer.from(expectedEmail);
  const sameEmail =
    emailA.length === emailB.length && timingSafeEqual(emailA, emailB);
  const validPassword = verifyPassword(password, storedHash);
  return sameEmail && validPassword;
}
