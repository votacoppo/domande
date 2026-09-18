import type { PublishedQuestion } from "./questions-types.ts";

export function toPublishedQuestions(rows: Array<Record<string, unknown>>): PublishedQuestion[] {
  return rows.flatMap((row) => {
    if (
      row.status !== "published" ||
      typeof row.id !== "string" ||
      typeof row.question_text !== "string" ||
      typeof row.published_at !== "string"
    ) return [];
    return [{
      id: row.id,
      question_text: row.question_text,
      published_at: row.published_at,
    }];
  });
}
