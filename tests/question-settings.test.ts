import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUESTION_SETTINGS,
  describeDeviceLimit,
  formatWait,
  identityNotice,
  parseSettingsInput,
  settingsFromRow,
} from "../lib/question-settings.ts";

test("il valore iniziale lascia il modulo anonimo con 3 domande l'ora", () => {
  assert.deepEqual(DEFAULT_QUESTION_SETTINGS, {
    nameField: "off",
    emailField: "off",
    deviceLimitMax: 3,
    deviceLimitWindowSeconds: 3600,
  });
  assert.equal(describeDeviceLimit(DEFAULT_QUESTION_SETTINGS), "3 domande ogni ora per telefono");
  assert.equal(describeDeviceLimit({ ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: 1, deviceLimitWindowSeconds: 86400 }), "1 domanda ogni 24 ore per telefono");
  assert.equal(describeDeviceLimit({ ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: null }), "Nessun limite per persona");
});

test("la dashboard può salvare solo valori dell'elenco", () => {
  assert.equal(parseSettingsInput({ ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: null }).ok, true);
  for (const bad of [
    null,
    [],
    { ...DEFAULT_QUESTION_SETTINGS, nameField: "sempre" },
    { ...DEFAULT_QUESTION_SETTINGS, emailField: undefined },
    { ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: 0 },
    { ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: 51 },
    { ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: 2.5 },
    { ...DEFAULT_QUESTION_SETTINGS, deviceLimitMax: "3" },
    { ...DEFAULT_QUESTION_SETTINGS, deviceLimitWindowSeconds: 7200 },
    { ...DEFAULT_QUESTION_SETTINGS, extra: true },
  ]) {
    assert.equal(parseSettingsInput(bad).ok, false, JSON.stringify(bad));
  }
});

test("la riga del database si converte e una riga fuori vincolo è un errore", () => {
  assert.deepEqual(settingsFromRow({
    name_field: "required",
    email_field: "optional",
    device_limit_max: null,
    device_limit_window_seconds: 900,
  }), { nameField: "required", emailField: "optional", deviceLimitMax: null, deviceLimitWindowSeconds: 900 });
  assert.throws(() => settingsFromRow({ name_field: "x", email_field: "off", device_limit_window_seconds: 3600 }));
});

test("l'attesa è scritta in parole", () => {
  assert.equal(formatWait(20), "meno di un minuto");
  assert.equal(formatWait(61), "2 minuti");
  assert.equal(formatWait(60), "1 minuto");
  assert.equal(formatWait(3600), "1 ora");
  assert.equal(formatWait(3601), "2 ore");
});

test("la frase per il pubblico segue i campi richiesti", () => {
  const base = DEFAULT_QUESTION_SETTINGS;
  assert.equal(identityNotice(base), "Non chiediamo nome né email.");
  assert.equal(identityNotice({ ...base, nameField: "optional" }), "Se lasci il nome, compare insieme alla domanda.");
  assert.equal(identityNotice({ ...base, nameField: "required", emailField: "optional" }), "Il nome compare insieme alla domanda. L’email non compare mai.");
  // Solo email: nessuna promessa sul nome, che non viene chiesto.
  assert.equal(identityNotice({ ...base, emailField: "required" }), "L’email non compare mai.");
});
