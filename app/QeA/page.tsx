import type { Metadata } from "next";
import { QrPanel } from "@/components/qr-panel";
import { QuestionWall } from "@/components/question-wall";
import { questionFormUrl } from "@/lib/config";
import { questionQrDataUrl } from "@/lib/qr";
import { listPublishedQuestions } from "@/lib/questions-repository";
import type { PublishedQuestion } from "@/lib/questions-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domande dal pubblico" };

export default async function QuestionWallPage() {
  let initialQuestions: PublishedQuestion[] = [];
  try {
    initialQuestions = await listPublishedQuestions();
  } catch {
    initialQuestions = [];
  }
  const [qrDataUrl, formUrl] = await Promise.all([questionQrDataUrl(), Promise.resolve(questionFormUrl())]);
  return (
    <main className="page">
      <div className="shell kiosk">
        <QrPanel dataUrl={qrDataUrl} formUrl={formUrl} />
        <QuestionWall initialQuestions={initialQuestions} />
      </div>
    </main>
  );
}
