export type QuestionStatus = "pending" | "published" | "rejected";

export type QuestionRow = {
  id: string;
  question_text: string;
  status: QuestionStatus;
  created_at: string;
  published_at: string | null;
  rejected_at: string | null;
};

export type PublishedQuestion = {
  id: string;
  question_text: string;
  published_at: string;
};

export type AdminBucket = "pending" | "published" | "saved" | "rejected";

export type ArchiveSummary = {
  id: string;
  name: string;
  created_at: string;
  question_count: number;
};

export type ArchiveItem = {
  id: string;
  original_question_id: string | null;
  question_text: string;
  status: QuestionStatus;
  admin_bucket: AdminBucket;
  created_at: string;
  published_at: string | null;
  rejected_at: string | null;
};

export type AdminSnapshot = {
  pending: QuestionRow[];
  published: QuestionRow[];
  saved: QuestionRow[];
  rejected: QuestionRow[];
  archives: ArchiveSummary[];
};

export type QuestionAction =
  | "publish"
  | "reject"
  | "unpublish"
  | "republish"
  | "highlight"
  | "delete_permanent";
