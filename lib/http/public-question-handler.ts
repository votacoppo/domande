import { safeUserAgent, validateQuestionInput } from "../question-input.ts";
import type { QuestionSettings } from "../question-settings.ts";
import { mutationGuard, readJsonBody } from "../security/request.ts";

export type SubmissionGuardResult =
  | { ok: true; ipHash: string }
  | { ok: false; status: number; error: string; silent?: boolean; retryAfter?: number };

export type PublicQuestionDependencies = {
  privacyReady: () => boolean;
  sourceUrl: () => string;
  loadSettings: () => Promise<QuestionSettings>;
  resolveDevice: (request: Request) => { hash: string; newId: string | null };
  deviceCookie: (id: string) => string;
  verifySubmission: (
    request: Request,
    record: Record<string, unknown>,
    context: { deviceHash: string; settings: QuestionSettings },
  ) => Promise<SubmissionGuardResult>;
  insertQuestion: (input: {
    questionText: string;
    displayName: string | null;
    contactEmail: string | null;
    ipHash: string;
    userAgent: string | null;
    source: string;
  }) => Promise<{ id: string }>;
};

const UNAVAILABLE = { error: "Impossibile inviare la domanda. Riprova tra poco." };

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

  // Senza impostazioni non sappiamo quali campi sono obbligatori né quale limite
  // applicare: meglio fermarsi che accettare con regole sbagliate.
  let settings: QuestionSettings;
  let device: { hash: string; newId: string | null };
  try {
    settings = await dependencies.loadSettings();
    device = dependencies.resolveDevice(request);
  } catch {
    return Response.json(UNAVAILABLE, { status: 503 });
  }

  // Il modulo si controlla prima dei limiti: un campo mancante non consuma tentativi.
  const input = validateQuestionInput(body.value, settings);
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });

  const guard = await dependencies.verifySubmission(request, input.record, {
    deviceHash: device.hash,
    settings,
  });
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
      displayName: input.value.displayName,
      contactEmail: input.value.contactEmail,
      ipHash: guard.ipHash,
      userAgent: safeUserAgent(request.headers.get("user-agent")),
      source: dependencies.sourceUrl(),
    });
    const headers = device.newId ? { "Set-Cookie": dependencies.deviceCookie(device.newId) } : undefined;
    return Response.json({ ok: true, id: result.id }, { headers });
  } catch {
    return Response.json(UNAVAILABLE, { status: 503 });
  }
}
