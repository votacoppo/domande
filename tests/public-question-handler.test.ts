import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePublicQuestion,
  type PublicQuestionDependencies,
} from "../lib/http/public-question-handler.ts";

process.env.SITE_URL = "https://domande.example";

function request(body: unknown, origin = "https://domande.example"): Request {
  return new Request("https://domande.example/api/domande", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "user-agent": "browser-test" },
    body: JSON.stringify(body),
  });
}

function dependencies(): PublicQuestionDependencies & { calls: { guard: number; insert: number } } {
  const calls = { guard: 0, insert: 0 };
  return {
    calls,
    privacyReady: () => true,
    sourceUrl: () => "https://domande.example/QeA/invia",
    verifySubmission: async () => {
      calls.guard += 1;
      return { ok: true, ipHash: "a".repeat(64) };
    },
    insertQuestion: async () => {
      calls.insert += 1;
      return { id: "question-id" };
    },
  };
}

const validBody = {
  questionText: "Qual è la priorità?",
  privacyAccepted: true,
  formLoadedAt: 1,
  turnstileToken: "token",
};

test("route invio: percorso valido arriva all'inserimento", async () => {
  const deps = dependencies();
  const response = await handlePublicQuestion(request(validBody), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, id: "question-id" });
  assert.deepEqual(deps.calls, { guard: 1, insert: 1 });
});

test("route invio: CSRF, payload e guard respinti non scrivono", async () => {
  const csrf = dependencies();
  assert.equal((await handlePublicQuestion(request(validBody, "https://evil.example"), csrf)).status, 403);
  assert.deepEqual(csrf.calls, { guard: 0, insert: 0 });

  const invalid = dependencies();
  assert.equal((await handlePublicQuestion(request({ ...validBody, privacyAccepted: false }), invalid)).status, 400);
  assert.deepEqual(invalid.calls, { guard: 0, insert: 0 });

  const blocked = dependencies();
  blocked.verifySubmission = async () => {
    blocked.calls.guard += 1;
    return { ok: false, status: 403, error: "captcha" };
  };
  assert.equal((await handlePublicQuestion(request(validBody), blocked)).status, 403);
  assert.deepEqual(blocked.calls, { guard: 1, insert: 0 });
});
