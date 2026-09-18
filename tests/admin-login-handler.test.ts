import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAdminLogin,
  requireAdminSession,
  type AdminLoginDependencies,
} from "../lib/http/admin-login-handler.ts";

process.env.SITE_URL = "https://domande.example";

function request(password = "corretta", origin = "https://domande.example"): Request {
  return new Request("https://domande.example/api/interno/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: "admin@example.test", password }),
  });
}

function dependencies(): AdminLoginDependencies & { verified: number } {
  const result: AdminLoginDependencies & { verified: number } = {
    verified: 0,
    hashIp: () => "a".repeat(64),
    checkRateLimit: async () => ({ allowed: true }),
    verifyCredentials: (email, password) => {
      result.verified += 1;
      return email === "admin@example.test" && password === "corretta";
    },
  };
  return result;
}

test("login corretto e credenziali errate", async () => {
  const good = dependencies();
  assert.deepEqual(await evaluateAdminLogin(request(), good), { ok: true, email: "admin@example.test" });
  assert.equal(good.verified, 1);

  const bad = dependencies();
  const result = await evaluateAdminLogin(request("sbagliata"), bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.response.status, 401);
});

test("login limitato o CSRF non arriva alla password", async () => {
  const limited = dependencies();
  limited.checkRateLimit = async () => ({
    allowed: false,
    status: 429,
    error: "Troppi tentativi",
    retryAfter: 90,
  });
  const limitedResult = await evaluateAdminLogin(request(), limited);
  assert.equal(limitedResult.ok, false);
  if (!limitedResult.ok) {
    assert.equal(limitedResult.response.status, 429);
    assert.equal(limitedResult.response.headers.get("retry-after"), "90");
  }
  assert.equal(limited.verified, 0);

  const csrf = dependencies();
  const csrfResult = await evaluateAdminLogin(request("corretta", "https://evil.example"), csrf);
  assert.equal(csrfResult.ok, false);
  if (!csrfResult.ok) assert.equal(csrfResult.response.status, 403);
  assert.equal(csrf.verified, 0);
});

test("API amministrativa senza sessione è 401", () => {
  assert.equal(requireAdminSession(false)?.status, 401);
  assert.equal(requireAdminSession(true), null);
});
