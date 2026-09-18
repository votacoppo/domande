# Parità con marcocostanza.it/QeA

Sorgente di riferimento letta il 18 settembre 2026: repository PersonalBrand, commit `cb97b77`.
Il sorgente non è stato modificato; questa applicazione ne estrae soltanto la funzione Q&A.

## Funzioni replicate

- Pagina `/QeA` con QR, domanda più recente in evidenza e precedenti sotto.
- Pagina `/QeA/invia`, domanda da 3 a 500 caratteri, senza nome o email.
- Polling: wall ogni secondo, dashboard ogni due secondi; una richiesta alla volta e pausa quando
  la scheda non è visibile.
- Dashboard con quattro gruppi: In attesa, In sala, Salvate, Bocciate.
- Pubblica, boccia, rimetti in evidenza, rimuovi dalla sala, ripubblica ed elimina con conferma.
- Archivio nominato che salva uno snapshot con lo stato di ogni domanda e svuota la coda live.
- Login amministratore con scrypt, cookie firmato HttpOnly/Secure/SameSite e epoch per revocare
  tutte le sessioni.
- Honeypot, tempo minimo di compilazione, Turnstile e limite di 10 invii o login per IP/ora.

## Irrigidimenti rispetto al sorgente

- Turnstile, Supabase, IP affidabile e configurazioni server mancanti chiudono la funzione con 503:
  non esistono bypass di produzione.
- L'IP è trasformato con HMAC-SHA-256 e segreto separato; l'IP grezzo non viene salvato o loggato.
- Ogni mutazione richiede un `Origin` esatto; niente `?key=`, magic link, ruoli o scambi fra siti.
- L'archivio è una singola transazione SQL con lock; nessun fallback client non atomico.
- Il rate limit usa una RPC Supabase transazionale: richieste concorrenti sullo stesso IP non
  possono superare la soglia.
- RLS su tutte le tabelle; `anon` e `authenticated` non hanno privilegi. La chiave server vive
  soltanto nell'hosting e non può entrare nei bundle browser.
- QR generato dal vero `SITE_URL`, non copiato come immagine fissa.
- Gli archivi possono essere eliminati definitivamente dalla dashboard, con conferma, per rendere
  applicabile il periodo di conservazione privacy senza usare il pannello del database.
- CSP e dipendenze limitate alla funzione; nessun tracker, marketing, email o Cloudinary.
