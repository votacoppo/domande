# Configurazione e pubblicazione

Non incollare password o segreti in chat, commit, comandi o ticket. Inserirli direttamente nelle
variabili protette dei servizi.

## 1. Account, tutti dalla nuova email di Marcello

1. GitHub Free con repository privato `votacoppo/domande`.
2. Vercel Hobby nell'account dedicato. Il referente ha confermato che il progetto è privato e non
   commerciale; se questa condizione cambia, va ricontrollata l'idoneità del piano.
3. Supabase Free, organizzazione e progetto propri, regione UE.
4. Cloudflare Free con un widget Turnstile “Managed” per l'hostname assegnato dall'hosting.

## 2. Database

Le migrazioni versionate in `supabase/migrations/` creano schema, indici, RLS, privilegi,
archiviazione atomica, conservazione automatica e hardening dell'event trigger RLS. Vanno sempre
applicate in ordine e registrate nella cronologia `supabase_migrations.schema_migrations`.

## 3. Segreti e variabili

Partire da `.env.example`. I valori obbligatori sono:

- `SITE_URL`, `DEPLOY_PLATFORM=vercel`;
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`;
- chiavi pubblica/privata Turnstile e `TURNSTILE_EXPECTED_HOSTNAMES`;
- email amministratore, hash password, segreto sessione, epoch e segreto HMAC IP;
- nome e contatto del titolare, base giuridica, fornitore hosting e testo realistico sulla
  conservazione, tutti confermati da Marcello o dal suo referente privacy.

Marco esegue personalmente `node scripts/genera-accesso-dashboard-coppo.mjs` in un terminale
interattivo: genera password, hash e segreti, li registra direttamente nella cassaforte del
workspace e mostra una sola volta soltanto la password da consegnare. Non crea file con
credenziali, rifiuta esecuzioni headless e non sovrascrive un accesso esistente. La rotazione è
un'operazione distinta.

### Raccolta sicura degli accessi sul computer di Marco

Per inserire in una sola volta gli accessi temporanei necessari all'installazione, eseguire:

```bash
bash scripts/configura-accessi-coppo.sh
```

Lo script mostra un modello, accetta l'intero blocco compilato con un solo incolla e nasconde il
contenuto durante l'inserimento. I valori passano direttamente alla cassaforte protetta del
workspace: non vengono scritti nel repository, in un file temporaneo o nella cronologia della
shell. I campi vuoti vengono ignorati e possono essere aggiunti in seguito rilanciando lo script.

Il raccoglitore accetta anche password email, credenziali Cloudflare R2/S3, chiavi Supabase
aggiuntive e Vercel AI Gateway per predisporre la futura consegna completa al cliente. Questi valori
restano nella cassaforte e non vengono usati dall'app: per installazione e deploy vengono selezionati
soltanto gli accessi strettamente necessari.

### Procedura automatica verificabile

I comandi operativi non stampano segreti:

```bash
npm run deploy:preflight
npm run supabase:status
npm run supabase:migrate
npm run supabase:verify
npm run test:db:remote-safe
npm run supabase:cron-probe
npm run deploy:configure
npm run deploy:production
npm run deploy:status
```

Vanno eseguiti tramite il gestore `segreto.sh` indicando i soli nomi `COPPO_*` richiesti. La
configurazione crea il progetto Vercel inizialmente senza collegamento Git, verifica il dominio
gratuito restituito dall'API, configura un widget Cloudflare Turnstile Managed vincolato soltanto a
quel dominio e carica soltanto le variabili Production. Dopo il push su `main`,
`npm run deploy:production` pubblica via API esattamente i file del commit che coincide con
`origin/main` e verifica stato READY, target Production, SHA e alias. Cloudflare R2 e Vercel AI
Gateway non servono a questa applicazione.

Per gli aggiornamenti futuri: modificare il repository, eseguire i controlli, committare e inviare
`main`, quindi rilanciare `npm run deploy:production` con le credenziali del cliente. Non è
necessario usare l'account GitHub personale di Marco né collegare altri progetti Vercel.

## 4. Gate di consegna

| Controllo | Stato locale | Stato live |
|---|---|---|
| lint, TypeScript, test unitari, build | superato il 18/09/2026 | da ripetere dopo ogni deploy |
| migrazione, privilegi, concorrenza e rollback su PostgreSQL 18.6 isolato | superato il 18/09/2026 | superato sul Supabase del cliente il 18/09/2026 |
| layout 390 px, 1366×768 e 1920×1080, QR decodificato | superato il 18/09/2026 | da ripetere sull'URL pubblico |
| invio, login, moderazione, archivio e Turnstile reale | servizi simulati/test locale superati | **pendente** fino alla configurazione account |
| titolare, base giuridica, hosting e conservazione | gate tecnico presente | configurato con i dati indicati dal referente il 18/09/2026 |

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

Per questo progetto la scelta confermata è automatica: Supabase Cron gira ogni giorno alle 03:17
UTC. Le soglie interne sono 29 giorni per domande/archivi e 1 giorno per gli identificatori tecnici:
con una corsa giornaliera garantiscono i massimi dichiarati di 30 e 2 giorni anche nel caso peggiore.
La dashboard consente comunque la cancellazione anticipata. Il test remoto deve lasciare il job
`qea-retention-daily` sulla pianificazione finale e una corsa reale riuscita nella cronologia.
