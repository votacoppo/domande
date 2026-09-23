import { identityNotice, type QuestionSettings } from "@/lib/question-settings";

export function SubmitIntro({ settings }: { settings: QuestionSettings }) {
  return (
    <>
      <p className="eyebrow">Incontro pubblico</p>
      <h1>La tua domanda a Marcello Coppo</h1>
      <p className="lede">
        {identityNotice(settings)} Le domande selezionate vengono mostrate sullo schermo in sala.
      </p>
    </>
  );
}
