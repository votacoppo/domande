import assert from "node:assert/strict";
import test from "node:test";
import { extractTrustedClientIp, hashClientIp } from "../lib/security/ip.ts";
import { hasTrustedOrigin, safeAdminRedirect } from "../lib/security/request.ts";

test("usa solo l'header IP previsto dalla piattaforma", () => {
  process.env.DEPLOY_PLATFORM = "netlify";
  const request = new Request("https://example.test", { headers: {
    "x-nf-client-connection-ip": "203.0.113.9",
    "x-forwarded-for": "198.51.100.10",
  }});
  assert.equal(extractTrustedClientIp(request), "203.0.113.9");
});

test("su Vercel usa l'X-Forwarded-For riscritto dalla piattaforma", () => {
  process.env.DEPLOY_PLATFORM = "vercel";
  const request = new Request("https://example.test", { headers: {
    "x-forwarded-for": "203.0.113.11",
    "x-real-ip": "198.51.100.12",
  }});
  assert.equal(extractTrustedClientIp(request), "203.0.113.11");
});

test("HMAC IP è stabile e non contiene l'IP", () => {
  process.env.IP_HASH_SECRET = "s".repeat(48);
  const one = hashClientIp("203.0.113.9");
  const two = hashClientIp("203.0.113.9");
  assert.equal(one, two);
  assert.equal(one.length, 64);
  assert.equal(one.includes("203.0.113.9"), false);
});

test("origin e redirect sono allowlist esatte", () => {
  process.env.SITE_URL = "https://domande.example";
  assert.equal(hasTrustedOrigin(new Request("https://domande.example/api", { headers: { origin: "https://domande.example" } })), true);
  assert.equal(hasTrustedOrigin(new Request("https://domande.example/api", { headers: { origin: "https://evil.example" } })), false);
  assert.equal(safeAdminRedirect("/interno/domande"), "/interno/domande");
  assert.equal(safeAdminRedirect("//evil.example"), "/interno");
});

test("cookie del dispositivo: formato rigido, hash stabile e valori manomessi scartati", async () => {
  process.env.IP_HASH_SECRET = "s".repeat(48);
  const { DEVICE_COOKIE, deviceCookieHeader, hashDeviceId, newDeviceId, readDeviceId, resolveDevice } =
    await import("../lib/security/device.ts");
  const id = newDeviceId();
  assert.match(id, /^[A-Za-z0-9_-]{43}$/);
  const withCookie = new Request("https://example.test", { headers: { cookie: `altro=1; ${DEVICE_COOKIE}=${id}` } });
  assert.equal(readDeviceId(withCookie), id);
  assert.deepEqual(resolveDevice(withCookie), { hash: hashDeviceId(id), newId: null });
  assert.equal(hashDeviceId(id).length, 64);
  assert.equal(hashDeviceId(id).includes(id), false);
  // L'hash del dispositivo non coincide con quello di un IP con lo stesso valore.
  assert.notEqual(hashDeviceId(id), hashClientIp(id));

  for (const forged of ["corto", `${id}x`, "a".repeat(42) + "!", "' or 1=1 --"]) {
    const request = new Request("https://example.test", { headers: { cookie: `${DEVICE_COOKIE}=${forged}` } });
    assert.equal(readDeviceId(request), null);
    const resolved = resolveDevice(request);
    assert.match(resolved.newId ?? "", /^[A-Za-z0-9_-]{43}$/);
  }
  const header = deviceCookieHeader(id);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, /Path=\/api\/domande/);
  assert.match(header, /Max-Age=86400/);
});
