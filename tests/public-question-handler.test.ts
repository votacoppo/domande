import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePublicQuestion,
  type PublicQuestionDependencies,
} from "../lib/http/public-question-handler.ts";
import { DEFAULT_QUESTION_SETTINGS, type QuestionSettings } from "../lib/question-settings.ts";

process.env.SITE_URL = "https://domande.example";

function request(body: unknown, origin = "https://domande.example"): Request {
  return new Request("https://domande.example/api/domande", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "user-agent": "browser-test" },
    body: JSON.stringify(body),
  });
}

type Inserted = Parameters<PublicQuestionDependencies["insertQuestion"]>[0];

function dependencies(settings: QuestionSettings = DEFAULT_QUESTION_SETTINGS, newId: string | null = null) {
  const calls = { guard: 0, insert: 0 };
  const inserted: Inserted[] = [];
  const deps: PublicQuestionDependencies = {
    privacyReady: () => true,
    sourceUrl: () => "https://domande.example/QeA/invia",
    loadSettings: async () => settings,
    resolveDevice: () => ({ hash: "d".repeat(64), newId }),
    deviceCookie: (id) => `qea_dispositivo=${id}; Path=/api/domande`,
    verifySubmission: async () => {
      calls.guard += 1;
      return { ok: true, ipHash: "a".repeat(64) };
    },
    insertQuestion: async (input) => {
      calls.insert += 1;
      inserted.push(input);
      return { id: "question-id" };
    },
  };
  return { deps, calls, inserted };
}

const validBody = {
  questionText: "Qual è la priorità?",
  privacyAccepted: true,
  formLoadedAt: 1,
  turnstileToken: "token",
};

test("route invio: percorso valido arriva all'inserimento", async () => {
  const { deps, calls } = dependencies();
  const response = await handlePublicQuestion(request(validBody), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, id: "question-id" });
  assert.deepEqual(calls, { guard: 1, insert: 1 });
  assert.equal(response.headers.get("set-cookie"), null);
});

test("route invio: CSRF, payload e guard respinti non scrivono", async () => {
  const csrf = dependencies();
  assert.equal((await handlePublicQuestion(request(validBody, "https://evil.example"), csrf.deps)).status, 403);
  assert.deepEqual(csrf.calls, { guard: 0, insert: 0 });

  const invalid = dependencies();
  assert.equal((await handlePublicQuestion(request({ ...validBody, privacyAccepted: false }), invalid.deps)).status, 400);
  assert.deepEqual(invalid.calls, { guard: 0, insert: 0 });

  const blocked = dependencies();
  blocked.deps.verifySubmission = async () => {
    blocked.calls.guard += 1;
    return { ok: false, status: 403, error: "captcha" };
  };
  assert.equal((await handlePublicQuestion(request(validBody), blocked.deps)).status, 403);
  assert.deepEqual(blocked.calls, { guard: 1, insert: 0 });
});

test("campo obbligatorio mancante: 400 senza consumare il limite", async () => {
  const { deps, calls } = dependencies({ ...DEFAULT_QUESTION_SETTINGS, nameField: "required" });
  const response = await handlePublicQuestion(request(validBody), deps);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Inserisci nome e cognome." });
  assert.deepEqual(calls, { guard: 0, insert: 0 });
});

test("nome ed email salvati solo se il selettore li chiede", async () => {
  const body = { ...validBody, displayName: "Luca Bianco", contactEmail: "luca@example.com" };
  const off = dependencies();
  await handlePublicQuestion(request(body), off.deps);
  assert.deepEqual([off.inserted[0]?.displayName, off.inserted[0]?.contactEmail], [null, null]);

  const on = dependencies({ ...DEFAULT_QUESTION_SETTINGS, nameField: "optional", emailField: "required" });
  await handlePublicQuestion(request(body), on.deps);
  assert.deepEqual([on.inserted[0]?.displayName, on.inserted[0]?.contactEmail], ["Luca Bianco", "luca@example.com"]);
});

test("un telefono nuovo riceve il cookie tecnico solo quando l'invio riesce", async () => {
  const ok = dependencies(DEFAULT_QUESTION_SETTINGS, "n".repeat(43));
  const response = await handlePublicQuestion(request(validBody), ok.deps);
  assert.equal(response.headers.get("set-cookie"), `qea_dispositivo=${"n".repeat(43)}; Path=/api/domande`);

  const limited = dependencies(DEFAULT_QUESTION_SETTINGS, "n".repeat(43));
  limited.deps.verifySubmission = async () => ({ ok: false, status: 429, error: "limite", retryAfter: 120 });
  const blocked = await handlePublicQuestion(request(validBody), limited.deps);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "120");
  assert.equal(blocked.headers.get("set-cookie"), null);
});

test("impostazioni o segreto non disponibili: 503 senza scrivere", async () => {
  const noSettings = dependencies();
  noSettings.deps.loadSettings = async () => {
    throw new Error("db");
  };
  assert.equal((await handlePublicQuestion(request(validBody), noSettings.deps)).status, 503);
  assert.deepEqual(noSettings.calls, { guard: 0, insert: 0 });

  const noSecret = dependencies();
  noSecret.deps.resolveDevice = () => {
    throw new Error("IP_HASH_SECRET non configurato");
  };
  assert.equal((await handlePublicQuestion(request(validBody), noSecret.deps)).status, 503);
  assert.deepEqual(noSecret.calls, { guard: 0, insert: 0 });
});
