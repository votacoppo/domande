import type { Metadata } from "next";
import { QuestionForm } from "@/components/question-form";
import { publicSetupComplete } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invia una domanda" };

export default function SubmitQuestionPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  return (
    <main className="page page-narrow">
      <p className="eyebrow">Incontro pubblico</p>
      <h1>La tua domanda a Marcello Coppo</h1>
      <p className="lede">
        Non chiediamo nome né email. Le domande selezionate vengono mostrate sullo schermo in sala.
      </p>
      <QuestionForm enabled={publicSetupComplete()} siteKey={siteKey} />
    </main>
  );
}
