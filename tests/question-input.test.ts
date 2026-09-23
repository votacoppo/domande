import assert from "node:assert/strict";
import test from "node:test";
import { safeUserAgent, validateQuestionInput } from "../lib/question-input.ts";
import { DEFAULT_QUESTION_SETTINGS, type FieldMode } from "../lib/question-settings.ts";

const anonymous = DEFAULT_QUESTION_SETTINGS;

function withModes(nameField: FieldMode, emailField: FieldMode) {
  return { ...DEFAULT_QUESTION_SETTINGS, nameField, emailField };
}

test("accetta una domanda valida e la normalizza", () => {
  const result = validateQuestionInput({ questionText: "  Come sostenere Asti?  ", privacyAccepted: true }, anonymous);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.questionText, "Come sostenere Asti?");
});

test("rifiuta privacy, testo corto e testo oltre 500 caratteri", () => {
  assert.equal(validateQuestionInput({ questionText: "Ciao", privacyAccepted: false }, anonymous).ok, false);
  assert.equal(validateQuestionInput({ questionText: "a", privacyAccepted: true }, anonymous).ok, false);
  assert.equal(validateQuestionInput({ questionText: "x".repeat(501), privacyAccepted: true }, anonymous).ok, false);
});

test("conta i caratteri Unicode come PostgreSQL", () => {
  assert.equal(validateQuestionInput({ questionText: "👍👍", privacyAccepted: true }, anonymous).ok, false);
  assert.equal(validateQuestionInput({ questionText: "👍👍👍", privacyAccepted: true }, anonymous).ok, true);
});

test("tutte le 9 combinazioni di nome ed email si comportano come il selettore", () => {
  const modes: FieldMode[] = ["off", "optional", "required"];
  for (const nameField of modes) {
    for (const emailField of modes) {
      const settings = withModes(nameField, emailField);
      const empty = validateQuestionInput({ questionText: "Domanda di prova", privacyAccepted: true }, settings);
      const mustFail = nameField === "required" || emailField === "required";
      assert.equal(empty.ok, !mustFail, `vuoto con ${nameField}/${emailField}`);

      const filled = validateQuestionInput({
        questionText: "Domanda di prova",
        displayName: "  Maria   D’Alessio ",
        contactEmail: " maria@example.com ",
        privacyAccepted: true,
      }, settings);
      assert.equal(filled.ok, true, `compilato con ${nameField}/${emailField}`);
      if (filled.ok) {
        assert.equal(filled.value.displayName, nameField === "off" ? null : "Maria D’Alessio");
        assert.equal(filled.value.contactEmail, emailField === "off" ? null : "maria@example.com");
      }
    }
  }
});

test("con «Non chiedere» scarta anche valori non validi", () => {
  const result = validateQuestionInput({
    questionText: "Domanda di prova",
    displayName: "https://spam.example",
    contactEmail: 42,
    privacyAccepted: true,
  }, anonymous);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([result.value.displayName, result.value.contactEmail], [null, null]);
});

test("nome ed email fuori formato vengono rifiutati", () => {
  const settings = withModes("optional", "optional");
  const base = { questionText: "Domanda di prova", privacyAccepted: true };
  for (const displayName of ["A", "x".repeat(81), "mario@example.com", "www.sito.it/x", "123 Rossi", 7]) {
    assert.equal(validateQuestionInput({ ...base, displayName }, settings).ok, false, String(displayName));
  }
  for (const contactEmail of ["mario", "mario@", "a@b", "ma rio@example.com", `${"x".repeat(250)}@e.it`]) {
    assert.equal(validateQuestionInput({ ...base, contactEmail }, settings).ok, false, contactEmail);
  }
  assert.equal(validateQuestionInput({ ...base, displayName: "   " }, settings).ok, true);
});

test("limita lo user agent a 512 caratteri", () => {
  assert.equal(safeUserAgent("x".repeat(700))?.length, 512);
});
