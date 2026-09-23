import assert from "node:assert/strict";
import test from "node:test";
import { handleGetSettings, handleSaveSettings, type SettingsDependencies } from "../lib/http/settings-handler.ts";
import { DEFAULT_QUESTION_SETTINGS, type QuestionSettings } from "../lib/question-settings.ts";

process.env.SITE_URL = "https://domande.example";

function put(body: unknown, origin = "https://domande.example"): Request {
  return new Request("https://domande.example/api/interno/impostazioni", {
    method: "PUT",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

function dependencies(authenticated = true) {
  const saved: QuestionSettings[] = [];
  const deps: SettingsDependencies = {
    authenticated: async () => authenticated,
    load: async () => DEFAULT_QUESTION_SETTINGS,
    save: async (settings) => {
      saved.push(settings);
      return settings;
    },
  };
  return { deps, saved };
}

const next: QuestionSettings = { nameField: "optional", emailField: "required", deviceLimitMax: 5, deviceLimitWindowSeconds: 10800 };

test("impostazioni: senza login 401 in lettura e scrittura", async () => {
  const { deps, saved } = dependencies(false);
  assert.equal((await handleGetSettings(deps)).status, 401);
  assert.equal((await handleSaveSettings(put(next), deps)).status, 401);
  assert.equal(saved.length, 0);
});

test("impostazioni: origine estranea 403 e valore fuori elenco 400", async () => {
  const foreign = dependencies();
  assert.equal((await handleSaveSettings(put(next, "https://evil.example"), foreign.deps)).status, 403);
  const invalid = dependencies();
  assert.equal((await handleSaveSettings(put({ ...next, emailField: "sempre" }), invalid.deps)).status, 400);
  assert.equal(foreign.saved.length + invalid.saved.length, 0);
});

test("impostazioni: lettura e salvataggio autenticati", async () => {
  const { deps, saved } = dependencies();
  const read = await handleGetSettings(deps);
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { settings: DEFAULT_QUESTION_SETTINGS });
  const write = await handleSaveSettings(put(next), deps);
  assert.equal(write.status, 200);
  assert.deepEqual(saved, [next]);
});
