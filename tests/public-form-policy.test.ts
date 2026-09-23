import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyPublicSubmission,
  type PublicGuardDependencies,
} from "../lib/security/public-form-policy.ts";
import { DEFAULT_QUESTION_SETTINGS } from "../lib/question-settings.ts";
import type { RateLimitInput, RateLimitResult } from "../lib/security/rate-limit-policy.ts";

const request = new Request("https://domande.example/api");
const record = { formLoadedAt: 1_000, turnstileToken: "token", _gotcha: "" };
const context = { deviceHash: "d".repeat(64), settings: DEFAULT_QUESTION_SETTINGS };

type Tracked = PublicGuardDependencies & { captchaCalls: number; rateCalls: RateLimitInput[] };

function dependencies(rate: (input: RateLimitInput) => RateLimitResult = () => ({ allowed: true })): Tracked {
  const result: Tracked = {
    captchaCalls: 0,
    rateCalls: [],
    now: () => 5_000,
    hashIp: () => "a".repeat(64),
    verifyCaptcha: async () => {
      result.captchaCalls += 1;
      return { ok: true };
    },
    checkRateLimit: async (input) => {
      result.rateCalls.push(input);
      return rate(input);
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
    const result = await verifyPublicSubmission(request, record, context, deps);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, status);
    assert.equal(deps.rateCalls.length, 0);
  }
});

test("honeypot e tempo minimo non chiamano servizi esterni", async () => {
  const bot = dependencies();
  const botResult = await verifyPublicSubmission(request, { ...record, _gotcha: "spam" }, context, bot);
  assert.equal(botResult.ok, false);
  assert.deepEqual({ captcha: bot.captchaCalls, rate: bot.rateCalls.length }, { captcha: 0, rate: 0 });

  const fast = dependencies();
  const fastResult = await verifyPublicSubmission(request, { ...record, formLoadedAt: 4_999 }, context, fast);
  assert.equal(fastResult.ok, false);
  assert.deepEqual({ captcha: fast.captchaCalls, rate: fast.rateCalls.length }, { captcha: 0, rate: 0 });
});

test("prima il limite per telefono deciso in dashboard, poi il tetto di 60 per rete", async () => {
  const deps = dependencies();
  const settings = { ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: 5, deviceLimitWindowSeconds: 900 as const };
  const result = await verifyPublicSubmission(request, record, { ...context, settings }, deps);
  assert.deepEqual(result, { ok: true, ipHash: "a".repeat(64) });
  assert.deepEqual(deps.rateCalls, [
    { key: "question-device", identifier: "d".repeat(64), max: 5, windowSeconds: 900 },
    { key: "question-submit", identifier: "a".repeat(64), max: 60, windowSeconds: 3600 },
  ]);
});

test("«Nessun limite per persona» lascia solo il tetto per rete", async () => {
  const deps = dependencies();
  const settings = { ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: null };
  await verifyPublicSubmission(request, record, { ...context, settings }, deps);
  assert.deepEqual(deps.rateCalls.map((call) => call.key), ["question-submit"]);
});

test("telefono bloccato: messaggio con l'attesa vera e rete non consumata", async () => {
  const deps = dependencies((input) => input.key === "question-device"
    ? { allowed: false, status: 429, error: "x", retryAfter: 700 }
    : { allowed: true });
  const result = await verifyPublicSubmission(request, record, context, deps);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 429);
    assert.equal(result.retryAfter, 700);
    assert.equal(result.error, "Hai già inviato 3 domande: potrai mandarne un’altra tra 12 minuti.");
  }
  assert.deepEqual(deps.rateCalls.map((call) => call.key), ["question-device"]);
});

test("rete satura e database giù danno messaggi distinti", async () => {
  const network = dependencies((input) => input.key === "question-submit"
    ? { allowed: false, status: 429, error: "x", retryAfter: 3000 }
    : { allowed: true });
  const saturated = await verifyPublicSubmission(request, record, context, network);
  assert.equal(saturated.ok, false);
  if (!saturated.ok) assert.equal(saturated.error, "Da questa rete sono arrivate troppe domande. Riprova tra 50 minuti.");

  const down = dependencies(() => ({ allowed: false, status: 503, error: "Servizio temporaneamente non disponibile." }));
  const unavailable = await verifyPublicSubmission(request, record, context, down);
  assert.equal(unavailable.ok, false);
  if (!unavailable.ok) assert.equal(unavailable.status, 503);
});
