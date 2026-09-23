import { QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from "./config.ts";
import type { FieldMode, QuestionSettings } from "./question-settings.ts";

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 80;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

// Solo lettere, spazi, apostrofi, punti e trattini: sulla parete non devono
// comparire link, email o altri testi travestiti da nome.
const DISPLAY_NAME = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;
// Stesso controllo del vincolo nel database.
const CONTACT_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type QuestionInput = {
  questionText: string;
  displayName: string | null;
  contactEmail: string | null;
  privacyAccepted: true;
};

type FieldResult = { ok: true; value: string | null } | { ok: false; error: string };

/** Applica la modalità del campo; restituisce il testo normalizzato o null se assente. */
function readField(raw: unknown, mode: FieldMode, missingError: string): FieldResult {
  // Con «Non chiedere» il server scarta qualsiasi valore arrivi comunque.
  if (mode === "off") return { ok: true, value: null };
  if (raw !== undefined && raw !== null && typeof raw !== "string") return { ok: false, error: missingError };
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (value) return { ok: true, value };
  return mode === "required" ? { ok: false, error: missingError } : { ok: true, value: null };
}

function validateDisplayName(raw: unknown, mode: FieldMode): FieldResult {
  const field = readField(raw, mode, "Inserisci nome e cognome.");
  if (!field.ok || field.value === null) return field;
  const length = Array.from(field.value).length;
  if (length < DISPLAY_NAME_MIN_LENGTH || length > DISPLAY_NAME_MAX_LENGTH || !DISPLAY_NAME.test(field.value)) {
    return {
      ok: false,
      error: `Il nome può contenere solo lettere, spazi, apostrofi e trattini (${DISPLAY_NAME_MIN_LENGTH}–${DISPLAY_NAME_MAX_LENGTH} caratteri).`,
    };
  }
  return field;
}

function validateContactEmail(raw: unknown, mode: FieldMode): FieldResult {
  const field = readField(raw, mode, "Inserisci la tua email.");
  if (!field.ok || field.value === null) return field;
  const length = Array.from(field.value).length;
  if (length < 6 || length > CONTACT_EMAIL_MAX_LENGTH || !CONTACT_EMAIL.test(field.value)) {
    return { ok: false, error: "Controlla l’indirizzo email." };
  }
  return field;
}

export function validateQuestionInput(
  body: unknown,
  settings: QuestionSettings,
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
  const displayName = validateDisplayName(record.displayName, settings.nameField);
  if (!displayName.ok) return displayName;
  const contactEmail = validateContactEmail(record.contactEmail, settings.emailField);
  if (!contactEmail.ok) return contactEmail;
  return {
    ok: true,
    value: {
      questionText,
      displayName: displayName.value,
      contactEmail: contactEmail.value,
      privacyAccepted: true,
    },
    record,
  };
}

export function safeUserAgent(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 512);
}
