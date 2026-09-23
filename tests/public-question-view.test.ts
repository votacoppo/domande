import assert from "node:assert/strict";
import test from "node:test";
import { toPublishedQuestions } from "../lib/public-question-view.ts";

test("l'API pubblica non espone IP, user agent, email o domande non pubblicate", () => {
  const published = toPublishedQuestions([{
    id: "pubblicata",
    question_text: "Domanda visibile",
    published_at: "2026-09-18T10:00:00.000Z",
    ip_hash: "a".repeat(64),
    user_agent: "segreto tecnico",
    display_name: "Giulia Ferraris",
    contact_email: "giulia@example.com",
    status: "published",
  }, {
    id: "pending",
    question_text: "Non ancora pubblicata",
    published_at: null,
    ip_hash: "b".repeat(64),
    user_agent: "altro",
    status: "pending",
  }]);
  assert.deepEqual(published, [{
    id: "pubblicata",
    question_text: "Domanda visibile",
    display_name: "Giulia Ferraris",
    published_at: "2026-09-18T10:00:00.000Z",
  }]);
  assert.equal("ip_hash" in published[0], false);
  assert.equal("user_agent" in published[0], false);
  assert.equal("contact_email" in published[0], false);
  assert.equal(JSON.stringify(published).includes("giulia@example.com"), false);
});
