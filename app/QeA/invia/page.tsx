import type { Metadata } from "next";
import { QuestionForm } from "@/components/question-form";
import { SubmitIntro } from "@/components/submit-intro";
import { publicSetupComplete } from "@/lib/config";
import { getQuestionSettingsOrDefault } from "@/lib/question-settings-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invia una domanda" };

export default async function SubmitQuestionPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const settings = await getQuestionSettingsOrDefault();
  return (
    <main className="page page-narrow">
      <SubmitIntro settings={settings} />
      <QuestionForm enabled={publicSetupComplete()} siteKey={siteKey} settings={settings} />
    </main>
  );
}
