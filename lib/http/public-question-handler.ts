import { safeUserAgent, validateQuestionInput } from "../question-input.ts";
import { mutationGuard, readJsonBody } from "../security/request.ts";

export type SubmissionGuardResult =
  | { ok: true; ipHash: string }
  | { ok: false; status: number; error: string; silent?: boolean; retryAfter?: number };

export type PublicQuestionDependencies = {
  privacyReady: () => boolean;
  sourceUrl: () => string;
  verifySubmission: (
    request: Request,
    record: Record<string, unknown>,
  ) => Promise<SubmissionGuardResult>;
  insertQuestion: (input: {
    questionText: string;
    ipHash: string;
    userAgent: string | null;
    source: string;
  }) => Promise<{ id: string }>;
};

export async function handlePublicQuestion(
  request: Request,
  dependencies: PublicQuestionDependencies,
): Promise<Response> {
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  if (!dependencies.privacyReady()) {
    return Response.json({ error: "Modulo non ancora configurato." }, { status: 503 });
  }
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const input = validateQuestionInput(body.value);
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });

  const guard = await dependencies.verifySubmission(request, input.record);
  if (!guard.ok) {
    if (guard.silent) return Response.json({ ok: true });
    const headers = guard.status === 429
      ? { "Retry-After": String(guard.retryAfter ?? 3600) }
      : undefined;
    return Response.json({ error: guard.error }, { status: guard.status, headers });
  }

  try {
    const result = await dependencies.insertQuestion({
      questionText: input.value.questionText,
      ipHash: guard.ipHash,
      userAgent: safeUserAgent(request.headers.get("user-agent")),
      source: dependencies.sourceUrl(),
    });
    return Response.json({ ok: true, id: result.id });
  } catch {
    return Response.json(
      { error: "Impossibile inviare la domanda. Riprova tra poco." },
      { status: 503 },
    );
  }
}
