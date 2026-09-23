import { notFound } from "next/navigation";
import { QrPanel } from "@/components/qr-panel";
import { QuestionWall } from "@/components/question-wall";
import { questionFormUrl } from "@/lib/config";
import { questionQrDataUrl } from "@/lib/qr";
import { DEFAULT_QUESTION_SETTINGS } from "@/lib/question-settings";
import type { PublishedQuestion } from "@/lib/questions-types";

const longQuestion = (
  "Quali misure concrete intende sostenere per il lavoro, la sicurezza, la formazione e la crescita " +
  "delle imprese del territorio, con quali tempi, risorse, responsabilità e risultati verificabili? "
).repeat(3).slice(0, 500);

const questions: PublishedQuestion[] = [
  {
    id: "1",
    question_text: longQuestion,
    display_name: "Giulia Ferraris",
    published_at: "2026-09-18T10:30:00+02:00",
  },
  {
    id: "2",
    question_text: "Come possono istituzioni e imprese collaborare sulla formazione digitale?",
    display_name: "Luca Bianco",
    published_at: "2026-09-18T10:29:00+02:00",
  },
  {
    id: "3",
    question_text: "Qual è la priorità per la sicurezza nei luoghi di lavoro?",
    display_name: null,
    published_at: "2026-09-18T10:28:00+02:00",
  },
];

export default async function ReviewWallPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const dataUrl = await questionQrDataUrl();
  return (
    <main className="page">
      <div className="shell kiosk">
        <QrPanel
          dataUrl={dataUrl}
          formUrl={questionFormUrl()}
          settings={{ ...DEFAULT_QUESTION_SETTINGS, nameField: "optional", emailField: "optional" }}
        />
        <QuestionWall initialQuestions={questions} />
      </div>
    </main>
  );
}
