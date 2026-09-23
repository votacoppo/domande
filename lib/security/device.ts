import { createHmac, randomBytes } from "node:crypto";

export const DEVICE_COOKIE = "qea_dispositivo";
export const DEVICE_COOKIE_MAX_AGE = 24 * 60 * 60;
const DEVICE_ID = /^[A-Za-z0-9_-]{43}$/;

export type DeviceIdentity = { hash: string; newId: string | null };

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

/** Codice casuale del telefono: un valore manomesso viene ignorato e sostituito. */
export function readDeviceId(request: Request): string | null {
  const value = cookieValue(request, DEVICE_COOKIE);
  return value && DEVICE_ID.test(value) ? value : null;
}

export function newDeviceId(): string {
  return randomBytes(32).toString("base64url");
}

// Nel database finisce solo l'HMAC, con lo stesso segreto usato per gli IP ma un
// prefisso diverso: i due identificatori non sono confrontabili fra loro.
export function hashDeviceId(id: string): string {
  const secret = process.env.IP_HASH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("IP_HASH_SECRET non configurato");
  return createHmac("sha256", secret).update(`device:${id}`).digest("hex");
}

export function resolveDevice(request: Request): DeviceIdentity {
  const existing = readDeviceId(request);
  const id = existing ?? newDeviceId();
  return { hash: hashDeviceId(id), newId: existing ? null : id };
}

export function deviceCookieHeader(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${DEVICE_COOKIE}=${id}; Path=/api/domande; Max-Age=${DEVICE_COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict${secure}`;
}
