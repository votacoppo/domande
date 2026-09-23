import type { Metadata } from "next";
import { privacyConfig } from "@/lib/config";
import { DEVICE_COOKIE } from "@/lib/security/device";

export const metadata: Metadata = { title: "Informativa privacy" };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const config = privacyConfig();
  if (!config.configured) {
    return (
      <main className="page page-narrow legal">
        <h1>Informativa non ancora configurata</h1>
        <p className="notice notice-error">
          Titolare, contatto, base giuridica, hosting e conservazione devono essere confermati prima
          di abilitare gli invii.
        </p>
      </main>
    );
  }
  return (
    <main className="page page-narrow legal">
      <h1>Informativa privacy</h1>
      <p>
        Titolare del trattamento: <strong>{config.controllerName}</strong>. Contatto: {config.controllerContact}.
      </p>
      <h2>Dati trattati</h2>
      <p>
        Il modulo raccoglie il testo della domanda. Se il modulo lo prevede, può chiedere anche nome
        e cognome e un indirizzo email, in modo facoltativo o obbligatorio secondo quanto indicato
        accanto al campo. Il nome, se inserito, può essere mostrato sullo schermo della sala insieme
        alla domanda selezionata; l’email non viene mai mostrata pubblicamente ed è usata solo per
        ricontattarti in merito alla domanda, senza newsletter né comunicazioni promozionali.
      </p>
      <p>
        Per prevenire abusi, l’indirizzo IP viene trasformato sul server con una funzione HMAC non
        reversibile e il browser riceve un cookie tecnico ({DEVICE_COOKIE}, durata 24 ore) che serve
        solo a limitare il numero di domande inviate dallo stesso dispositivo; vengono inoltre
        trattati temporaneamente informazioni tecniche del browser, data e ora.
      </p>
      <p>
        Nel testo della domanda non inserire dati personali di terzi o informazioni particolarmente
        delicate. Le domande possono essere lette dal personale incaricato della moderazione e, se
        selezionate, mostrate pubblicamente sullo schermo della sala.
      </p>
      <h2>Finalità e base giuridica</h2>
      <p>
        I dati servono a ricevere, moderare e mostrare domande durante incontri pubblici e a
        proteggere il servizio da spam e tentativi di abuso. Il testo viene mostrato solo dopo
        moderazione. Base giuridica indicata dal titolare: {config.legalBasis}.
      </p>
      <p>
        Il conferimento è facoltativo. Senza il consenso la domanda non viene inviata e non ci sono
        altre conseguenze. Non vengono effettuate profilazione o decisioni esclusivamente
        automatizzate sulla persona; la selezione delle domande è svolta dalla moderazione.
      </p>
      <h2>Fornitori</h2>
      <p>
        L’applicazione usa {config.hostingProvider} per l’hosting, Supabase per il database e il
        limite alle richieste, Cloudflare Turnstile per l’anti-spam.
      </p>
      <h2>Conservazione</h2>
      <p>{config.retentionPolicy}</p>
      <h2>Diritti</h2>
      <p>
        Puoi revocare il consenso e chiedere informazioni, accesso, rettifica, cancellazione o
        limitazione usando il contatto indicato sopra; resta fermo il diritto di proporre reclamo
        al Garante per la protezione dei dati personali. Se hai indicato nome o email, possiamo
        individuare la tua domanda anche con questi dati; altrimenti potrebbe essere necessario
        indicarne il testo e il contesto di invio. La revoca non pregiudica la liceità del trattamento precedente.
      </p>
    </main>
  );
}
