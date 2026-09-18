import Link from "next/link";

export function QrPanel({ dataUrl, formUrl }: { dataUrl: string; formUrl: string }) {
  return (
    <aside className="panel qr-panel">
      {/* Il QR è generato localmente dal SITE_URL: nessuna richiesta a servizi esterni. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="qr-image" src={dataUrl} alt="QR per inviare una domanda" width={720} height={720} />
      <h2 className="qr-title">Inquadra e scrivi</h2>
      <p>Non chiediamo nome né email. Le domande selezionate compaiono sullo schermo.</p>
      <Link className="button" href="/QeA/invia">Scrivi una domanda</Link>
      <span className="qr-url">{formUrl}</span>
    </aside>
  );
}
