# Configurazione e pubblicazione

Non incollare password o segreti in chat, commit, comandi o ticket. Inserirli direttamente nelle
variabili protette dei servizi.

## 1. Account, tutti dalla nuova email di Marcello

1. GitHub Free con repository privato vuoto `marcello-coppo-qea`.
2. Hosting collegato solo a quel repository:
   - se il progetto e la sua realizzazione sono interamente non commerciali, si può usare il
     Vercel Hobby già creato;
   - se Marco viene pagato per realizzarlo o gestirlo, creare Netlify Free: Vercel Hobby esclude
     l'uso commerciale, compreso il lavoro svolto da un consulente retribuito.
3. Supabase Free, organizzazione e progetto propri, regione UE.
4. Cloudflare Free con un widget Turnstile “Managed” per l'hostname assegnato dall'hosting.

## 2. Database

Nel repository è presente `supabase/migrations/20260918085043_qea_schema.sql`. Eseguirla una sola
volta nel progetto nuovo tramite Supabase SQL Editor o CLI autenticata con l'account di Marcello.
La migrazione crea tabelle, indici, RLS, privilegi e la funzione atomica di archiviazione.

## 3. Segreti e variabili

Partire da `.env.example`. I valori obbligatori sono:

- `SITE_URL`, `DEPLOY_PLATFORM=netlify` oppure `DEPLOY_PLATFORM=vercel`;
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`;
- chiavi pubblica/privata Turnstile e `TURNSTILE_EXPECTED_HOSTNAMES`;
- email amministratore, hash password, segreto sessione, epoch e segreto HMAC IP;
- nome e contatto del titolare, base giuridica, fornitore hosting e testo realistico sulla
  conservazione, tutti confermati da Marcello o dal suo referente privacy.

`npm run setup:secrets` genera hash e segreti con input password mascherato. Eseguirlo sul computer
di chi configura l'hosting: l'output va copiato direttamente nelle variabili protette e non va
salvato nel repository.

### Raccolta sicura degli accessi sul computer di Marco

Per inserire in una sola volta gli accessi temporanei necessari all'installazione, eseguire:

```bash
bash scripts/configura-accessi-coppo.sh
```

Lo script mostra un modello, accetta l'intero blocco compilato con un solo incolla e nasconde il
contenuto durante l'inserimento. I valori passano direttamente alla cassaforte protetta del
workspace: non vengono scritti nel repository, in un file temporaneo o nella cronologia della
shell. I campi vuoti vengono ignorati e possono essere aggiunti in seguito rilanciando lo script.

La password della casella email non viene raccolta. Per questa applicazione non servono inoltre
le credenziali Cloudflare R2/S3, la chiave anon Supabase, la service-role legacy o una chiave
Vercel AI Gateway: concedere accessi che l'app non usa aumenterebbe inutilmente il rischio.

## 4. Gate di consegna

| Controllo | Stato locale | Stato live |
|---|---|---|
| lint, TypeScript, test unitari, build | superato il 18/09/2026 | da ripetere dopo ogni deploy |
| migrazione, privilegi, concorrenza e rollback su PostgreSQL 18.6 isolato | superato il 18/09/2026 | da ripetere sul Supabase del cliente |
| layout 390 px, 1366×768 e 1920×1080, QR decodificato | superato il 18/09/2026 | da ripetere sull'URL pubblico |
| invio, login, moderazione, archivio e Turnstile reale | servizi simulati/test locale superati | **pendente** fino alla configurazione account |
| titolare, base giuridica, hosting e conservazione | gate tecnico presente | **pendente** fino alla conferma del titolare |

L'app non abilita gli invii se manca anche uno solo dei dati privacy richiesti. Un test locale non
va riportato come prova live.

## 5. Verifica prima di ogni evento

1. Aprire `/interno/entra` e accedere.
2. Inviare una domanda di prova, pubblicarla, rimuoverla e archiviarla.
3. Aprire `/QeA` sullo schermo e decodificare il QR con un telefono.
4. Controllare che Supabase non sia in pausa e che l'hosting sia sotto i limiti mensili.

Supabase Free può mettere in pausa i progetti poco attivi; non usare ping artificiali. Riattivare
il progetto dal pannello prima dell'evento e rifare il test completo.

La procedura di cancellazione deve essere scelta prima dell'online e coincidere con il testo
`DATA_RETENTION_POLICY`. Se è manuale, deve indicare una scadenza operativa anteriore al limite
dichiarato e un responsabile: un generico controllo mensile non garantisce il rispetto di un giorno
esatto. La dashboard permette di eliminare singole domande e interi archivi con conferma.
