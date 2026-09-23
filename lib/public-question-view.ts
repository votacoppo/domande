import type { PublishedQuestion } from "./questions-types.ts";

export function toPublishedQuestions(rows: Array<Record<string, unknown>>): PublishedQuestion[] {
  return rows.flatMap((row) => {
    if (
      row.status !== "published" ||
      typeof row.id !== "string" ||
      typeof row.question_text !== "string" ||
      typeof row.published_at !== "string"
    ) return [];
    // Elenco chiuso di campi: email, IP e user agent non possono uscire per sbaglio.
    return [{
      id: row.id,
      question_text: row.question_text,
      display_name: typeof row.display_name === "string" ? row.display_name : null,
      published_at: row.published_at,
    }];
  });
}
