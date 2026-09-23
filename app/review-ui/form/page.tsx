import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/question-form";
import { SubmitIntro } from "@/components/submit-intro";
import type { QuestionSettings } from "@/lib/question-settings";

const reviewSettings: QuestionSettings = {
  nameField: "optional",
  emailField: "required",
  deviceLimitMax: 3,
  deviceLimitWindowSeconds: 3600,
};

export default function ReviewFormPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="page page-narrow">
      <SubmitIntro settings={reviewSettings} />
      <QuestionForm enabled siteKey="" settings={reviewSettings} preview />
    </main>
  );
}
