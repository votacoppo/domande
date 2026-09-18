import assert from "node:assert/strict";
import test from "node:test";
import { safeUserAgent, validateQuestionInput } from "../lib/question-input.ts";

test("accetta una domanda valida e la normalizza", () => {
  const result = validateQuestionInput({ questionText: "  Come sostenere Asti?  ", privacyAccepted: true });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.questionText, "Come sostenere Asti?");
});

test("rifiuta privacy, testo corto e testo oltre 500 caratteri", () => {
  assert.equal(validateQuestionInput({ questionText: "Ciao", privacyAccepted: false }).ok, false);
  assert.equal(validateQuestionInput({ questionText: "a", privacyAccepted: true }).ok, false);
  assert.equal(validateQuestionInput({ questionText: "x".repeat(501), privacyAccepted: true }).ok, false);
});

test("conta i caratteri Unicode come PostgreSQL", () => {
  assert.equal(validateQuestionInput({ questionText: "👍👍", privacyAccepted: true }).ok, false);
  assert.equal(validateQuestionInput({ questionText: "👍👍👍", privacyAccepted: true }).ok, true);
});

test("limita lo user agent a 512 caratteri", () => {
  assert.equal(safeUserAgent("x".repeat(700))?.length, 512);
});
