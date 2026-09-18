# Consegna a Marcello Coppo

Da consegnare con un canale sicuro, mai dentro il repository:

- accesso alla nuova email e relativi recovery code/2FA;
- account GitHub, hosting (Vercel o Netlify), Supabase e Cloudflare;
- credenziali della dashboard Q&A;
- questa guida operativa e la data dell'ultima prova live.

Il codice è nel repository GitHub del cliente. Ogni aggiornamento va prima committato e pubblicato
su `main`; il comando `npm run deploy:production`, eseguito con gli accessi del cliente, distribuisce
soltanto quel commit e ne verifica l'alias pubblico.

L'accesso alla dashboard usa l'email tecnica `votacoppodomande@gmail.com`; la password dedicata
viene generata separatamente e non coincide con email, database o altri servizi.

## Uso quotidiano

1. Apri `/interno/entra` dal telefono o computer di regia.
2. Mostra `/QeA` sullo schermo della sala.
3. Il pubblico inquadra il QR e invia da `/QeA/invia`.
4. Le domande arrivano in **In attesa**. Pubblica solo quelle che vuoi mostrare.
5. “Rimetti in evidenza” porta una domanda in cima. “Rimuovi da sala” la conserva in Salvate.
6. A fine incontro usa “Archivia tutto”, assegna un nome riconoscibile e riparti con la coda vuota.

## Sicurezza e recupero

- Per cambiare password, genera un nuovo `ADMIN_PASSWORD_HASH` e ridistribuisci.
- Per chiudere immediatamente tutte le sessioni, cambia `ADMIN_SESSION_EPOCH` e ridistribuisci.
- Non mettere mai la chiave Supabase server o il segreto Turnstile in variabili
  `NEXT_PUBLIC_*`.
- Il piano Supabase Free non include backup automatici garantiti: esportare periodicamente dati e
  migrazioni dall'account del cliente.
- La conservazione non si considera configurata finché Marcello non ha confermato il testo mostrato
  nell'informativa e chi è responsabile delle cancellazioni dalla dashboard.

## Limiti gratuiti verificati il 18 settembre 2026

- Vercel Hobby è adatto solo finché l'uso resta non commerciale, come confermato dal referente.
- Supabase Free ha limiti di spazio/traffico e può mettere in pausa i progetti inattivi.
- Turnstile Free ha propri limiti. I fornitori possono modificare i piani in futuro.
