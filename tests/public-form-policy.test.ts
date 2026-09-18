import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyPublicSubmission,
  type PublicGuardDependencies,
} from "../lib/security/public-form-policy.ts";

const request = new Request("https://domande.example/api");
const record = { formLoadedAt: 1_000, turnstileToken: "token", _gotcha: "" };

function dependencies(): PublicGuardDependencies & { captchaCalls: number; rateCalls: number } {
  const result: PublicGuardDependencies & { captchaCalls: number; rateCalls: number } = {
    captchaCalls: 0,
    rateCalls: 0,
    now: () => 5_000,
    hashIp: () => "a".repeat(64),
    verifyCaptcha: async () => {
      result.captchaCalls += 1;
      return { ok: true };
    },
    checkRateLimit: async () => {
      result.rateCalls += 1;
      return { allowed: true };
    },
  };
  return result;
}

test("captcha respinto o non configurato non scrive nel rate limit", async () => {
  for (const status of [403, 503] as const) {
    const deps = dependencies();
    deps.verifyCaptcha = async () => {
      deps.captchaCalls += 1;
      return { ok: false, status };
    };
    const result = await verifyPublicSubmission(request, record, deps);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, status);
    assert.equal(deps.rateCalls, 0);
  }
});

test("honeypot e tempo minimo non chiamano servizi esterni", async () => {
  const bot = dependencies();
  const botResult = await verifyPublicSubmission(request, { ...record, _gotcha: "spam" }, bot);
  assert.equal(botResult.ok, false);
  assert.deepEqual({ captcha: bot.captchaCalls, rate: bot.rateCalls }, { captcha: 0, rate: 0 });

  const fast = dependencies();
  const fastResult = await verifyPublicSubmission(request, { ...record, formLoadedAt: 4_999 }, fast);
  assert.equal(fastResult.ok, false);
  assert.deepEqual({ captcha: fast.captchaCalls, rate: fast.rateCalls }, { captcha: 0, rate: 0 });
});
