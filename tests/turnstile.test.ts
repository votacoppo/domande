import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstile } from "../lib/security/turnstile.ts";

function request(): Request {
  process.env.DEPLOY_PLATFORM = "vercel";
  return new Request("https://domande.example/api", {
    headers: { "x-forwarded-for": "203.0.113.20" },
  });
}

test("Turnstile non configurato è 503 e non chiama la rete", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_EXPECTED_HOSTNAMES = "domande.example";
  let calls = 0;
  const result = await verifyTurnstile("token", request(), {
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ success: true });
    },
  });
  assert.deepEqual(result, { ok: false, status: 503 });
  assert.equal(calls, 0);
});

test("Turnstile distingue token invalido e servizio indisponibile", async () => {
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  process.env.TURNSTILE_EXPECTED_HOSTNAMES = "domande.example";
  const invalid = await verifyTurnstile("token", request(), {
    fetchImpl: async () => Response.json({ success: false, "error-codes": ["invalid-input-response"] }),
  });
  assert.deepEqual(invalid, { ok: false, status: 403 });

  const unavailable = await verifyTurnstile("token", request(), {
    fetchImpl: async () => new Response("errore", { status: 503 }),
  });
  assert.deepEqual(unavailable, { ok: false, status: 503 });
});

test("Turnstile richiede action e hostname esatti", async () => {
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  process.env.TURNSTILE_EXPECTED_HOSTNAMES = "domande.example";
  const valid = await verifyTurnstile("token", request(), {
    fetchImpl: async () => Response.json({
      success: true,
      action: "audience-question",
      hostname: "domande.example",
    }),
  });
  assert.deepEqual(valid, { ok: true });

  const wrongHost = await verifyTurnstile("token", request(), {
    fetchImpl: async () => Response.json({
      success: true,
      action: "audience-question",
      hostname: "evil.example",
    }),
  });
  assert.deepEqual(wrongHost, { ok: false, status: 403 });
});

test("Turnstile interrompe una verifica bloccata", async () => {
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  process.env.TURNSTILE_EXPECTED_HOSTNAMES = "domande.example";
  let aborted = false;
  const result = await verifyTurnstile("token", request(), {
    timeoutMs: 5,
    fetchImpl: async (_url, init) => new Promise<Response>((resolve) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        resolve(new Response("aborted", { status: 503 }));
      });
    }),
  });
  assert.deepEqual(result, { ok: false, status: 503 });
  assert.equal(aborted, true);
});
