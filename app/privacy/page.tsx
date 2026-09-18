import type { Metadata } from "next";
import { privacyConfig } from "@/lib/config";

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
        Il modulo raccoglie il testo della domanda. Non chiede nome o email. Per prevenire abusi,
        l’indirizzo IP viene trasformato sul server con una funzione HMAC non reversibile; vengono
        inoltre trattati temporaneamente informazioni tecniche del browser, data e ora.
      </p>
      <h2>Finalità e base giuridica</h2>
      <p>
        I dati servono a ricevere, moderare e mostrare domande durante incontri pubblici e a
        proteggere il servizio da spam e tentativi di abuso. Il testo viene mostrato solo dopo
        moderazione. Base giuridica indicata dal titolare: {config.legalBasis}.
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
        Puoi chiedere informazioni, accesso o cancellazione usando il contatto indicato sopra.
        Poiché il modulo non raccoglie identità, potrebbe non essere possibile ricondurre una
        domanda specifica alla persona che l’ha inviata.
      </p>
    </main>
  );
}
