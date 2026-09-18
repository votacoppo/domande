import assert from "node:assert/strict";
import test from "node:test";
import { runRateLimitCheck } from "../lib/security/rate-limit-policy.ts";

const input = { key: "question-submit", ipHash: "a".repeat(64), max: 10 };

test("rate limit distingue ammesso e soglia superata", async () => {
  const allowed = await runRateLimitCheck(input, async () => ({
    data: [{ allowed: true, retry_after_seconds: 0 }], error: null,
  }));
  assert.deepEqual(allowed, { allowed: true });

  const blocked = await runRateLimitCheck(input, async () => ({
    data: [{ allowed: false, retry_after_seconds: 87.2 }], error: null,
  }));
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.status, 429);
    assert.equal(blocked.retryAfter, 88);
  }
});

test("rate limit chiude con 503 su errore, risposta malformata e timeout", async () => {
  const error = await runRateLimitCheck(input, async () => ({ data: null, error: { message: "db" } }));
  const malformed = await runRateLimitCheck(input, async () => ({ data: [{ allowed: "yes" }], error: null }));
  let aborted = false;
  const timeout = await runRateLimitCheck(input, (_value, signal) => new Promise((resolve) => {
    signal.addEventListener("abort", () => {
      aborted = true;
      resolve({ data: null, error: { message: "aborted" } });
    });
  }), 5);
  for (const result of [error, malformed, timeout]) {
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.status, 503);
  }
  assert.equal(aborted, true);
});
