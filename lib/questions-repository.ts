import "server-only";
import { getAdminClient } from "./supabase-admin";
import { toPublishedQuestions } from "./public-question-view";
import type {
  AdminBucket,
  AdminSnapshot,
  ArchiveItem,
  ArchiveSummary,
  PublishedQuestion,
  QuestionAction,
  QuestionRow,
} from "./questions-types";

const TABLE = "audience_questions";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Errore database";
}

export function adminBucket(row: Pick<QuestionRow, "status" | "published_at">): AdminBucket {
  if (row.status === "pending") return "pending";
  if (row.status === "published") return "published";
  return row.published_at ? "saved" : "rejected";
}

export async function insertQuestion(input: {
  questionText: string;
  ipHash: string;
  userAgent: string | null;
  source: string;
}): Promise<{ id: string }> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      question_text: input.questionText,
      status: "pending",
      ip_hash: input.ipHash,
      user_agent: input.userAgent,
      source: input.source,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Inserimento non riuscito");
  return { id: String(data.id) };
}

export async function listPublishedQuestions(): Promise<PublishedQuestion[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, question_text, published_at, status")
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return toPublishedQuestions((data ?? []) as Array<Record<string, unknown>>);
}

export async function listAdminSnapshot(): Promise<AdminSnapshot> {
  const supabase = getAdminClient();
  const [questionsResult, archivesResult] = await Promise.all([
    supabase
      .from(TABLE)
      .select("id, question_text, status, created_at, published_at, rejected_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("audience_question_archives")
      .select("id, name, created_at, question_count")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (questionsResult.error) throw new Error(questionsResult.error.message);
  if (archivesResult.error) throw new Error(archivesResult.error.message);

  const rows = (questionsResult.data ?? []) as QuestionRow[];
  const published = rows
    .filter((row) => adminBucket(row) === "published")
    .sort((a, b) => Date.parse(b.published_at ?? "") - Date.parse(a.published_at ?? ""));
  return {
    pending: rows.filter((row) => adminBucket(row) === "pending"),
    published,
    saved: rows.filter((row) => adminBucket(row) === "saved"),
    rejected: rows.filter((row) => adminBucket(row) === "rejected"),
    archives: (archivesResult.data ?? []) as ArchiveSummary[],
  };
}

export async function listArchiveItems(archiveId: string): Promise<ArchiveItem[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("audience_question_archive_items")
    .select(
      "id, original_question_id, question_text, status, admin_bucket, created_at, published_at, rejected_at",
    )
    .eq("archive_id", archiveId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArchiveItem[];
}

export async function deleteArchive(archiveId: string): Promise<void> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("audience_question_archives")
    .delete()
    .eq("id", archiveId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Archivio non trovato");
}

export async function updateQuestion(id: string, action: QuestionAction): Promise<void> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();
  if (action === "delete_permanent") {
    const { data, error } = await supabase.from(TABLE).delete().eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Domanda non trovata");
    return;
  }

  let query;
  if (action === "publish") {
    query = supabase
      .from(TABLE)
      .update({ status: "published", published_at: now, rejected_at: null })
      .eq("id", id)
      .eq("status", "pending");
  } else if (action === "reject") {
    query = supabase
      .from(TABLE)
      .update({ status: "rejected", rejected_at: now, published_at: null })
      .eq("id", id)
      .eq("status", "pending");
  } else if (action === "unpublish") {
    query = supabase
      .from(TABLE)
      .update({ status: "rejected", rejected_at: now })
      .eq("id", id)
      .eq("status", "published");
  } else if (action === "republish") {
    query = supabase
      .from(TABLE)
      .update({ status: "published", published_at: now, rejected_at: null })
      .eq("id", id)
      .eq("status", "rejected")
      .not("published_at", "is", null);
  } else {
    query = supabase
      .from(TABLE)
      .update({ published_at: now })
      .eq("id", id)
      .eq("status", "published");
  }
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La domanda non è nello stato richiesto");
}

export async function archiveAll(name: string): Promise<{ archiveId: string; questionCount: number }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) throw new Error("Nome archivio non valido");
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("archive_all_audience_questions", {
    p_name: trimmed,
  });
  if (error) {
    if (error.message.includes("NO_QUESTIONS")) throw new Error("Non ci sono domande da archiviare");
    throw new Error(error.message);
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== "object") throw new Error("Risposta archivio non valida");
  const row = result as { archive_id?: unknown; question_count?: unknown };
  return { archiveId: String(row.archive_id), questionCount: Number(row.question_count) };
}

export function repositoryError(error: unknown): string {
  return errorMessage(error);
}
