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
