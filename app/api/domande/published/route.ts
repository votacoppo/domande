import { NextResponse } from "next/server";
import { listPublishedQuestions } from "@/lib/questions-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const questions = await listPublishedQuestions();
    return NextResponse.json(
      { questions },
      { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } },
    );
  } catch {
    return NextResponse.json({ error: "Servizio non disponibile." }, { status: 503 });
  }
}
