import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth/session";
import { requireAdminSession } from "@/lib/http/admin-login-handler";
import {
  archiveAll,
  deleteArchive,
  listAdminSnapshot,
  listArchiveItems,
  updateQuestion,
} from "@/lib/questions-repository";
import type { QuestionAction } from "@/lib/questions-types";
import { mutationGuard, readJsonBody } from "@/lib/security/request";

export const dynamic = "force-dynamic";
const ACTIONS = new Set<QuestionAction>([
  "publish", "reject", "unpublish", "republish", "highlight", "delete_permanent",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const unauthorized = requireAdminSession(await hasAdminSession());
  if (unauthorized) return unauthorized;
  const archiveId = new URL(request.url).searchParams.get("archiveId")?.trim();
  try {
    if (archiveId) {
      if (!UUID.test(archiveId)) return NextResponse.json({ error: "Archivio non valido." }, { status: 400 });
      return NextResponse.json({ items: await listArchiveItems(archiveId) });
    }
    return NextResponse.json(await listAdminSnapshot());
  } catch {
    return NextResponse.json({ error: "Database non disponibile." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdminSession(await hasAdminSession());
  if (unauthorized) return unauthorized;
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const record = body.value && typeof body.value === "object" ? body.value as Record<string, unknown> : {};
  try {
    if (record.action === "archive_all") {
      const name = typeof record.name === "string" ? record.name : "";
      const result = await archiveAll(name);
      return NextResponse.json({ ok: true, ...result });
    }
    const id = typeof record.id === "string" ? record.id : "";
    if (record.action === "delete_archive") {
      if (!UUID.test(id)) {
        return NextResponse.json({ error: "Archivio non valido." }, { status: 400 });
      }
      await deleteArchive(id);
      return NextResponse.json({ ok: true });
    }
    const action = typeof record.action === "string" ? record.action as QuestionAction : null;
    if (!UUID.test(id) || !action || !ACTIONS.has(action)) {
      return NextResponse.json({ error: "Operazione non valida." }, { status: 400 });
    }
    await updateQuestion(id, action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const expected = error instanceof Error && /^(Nome archivio|Non ci sono|La domanda|Domanda non|Archivio non)/.test(error.message);
    return NextResponse.json(
      { error: expected ? error.message : "Operazione non riuscita." },
      { status: expected ? 400 : 503 },
    );
  }
}
