import { QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from "./config.ts";

export type QuestionInput = {
  questionText: string;
  privacyAccepted: true;
};

export function validateQuestionInput(
  body: unknown,
): { ok: true; value: QuestionInput; record: Record<string, unknown> } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Payload non valido." };
  }
  const record = body as Record<string, unknown>;
  if (record.privacyAccepted !== true) {
    return { ok: false, error: "È necessario accettare l’informativa privacy." };
  }
  if (typeof record.questionText !== "string") {
    return { ok: false, error: "Scrivi una domanda valida." };
  }
  const questionText = record.questionText.trim();
  const questionLength = Array.from(questionText).length;
  if (questionLength < QUESTION_MIN_LENGTH) {
    return { ok: false, error: "Scrivi una domanda di almeno 3 caratteri." };
  }
  if (questionLength > QUESTION_MAX_LENGTH) {
    return { ok: false, error: `La domanda non può superare ${QUESTION_MAX_LENGTH} caratteri.` };
  }
  return {
    ok: true,
    value: { questionText, privacyAccepted: true },
    record,
  };
}

export function safeUserAgent(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 512);
}
