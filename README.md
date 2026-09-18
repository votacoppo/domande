# Domande dal pubblico — Marcello Coppo

Applicazione autonoma per raccogliere domande senza chiedere nome o email, moderarle da una
dashboard privata e mostrarle su uno schermo durante un incontro pubblico.

La parità funzionale è documentata in `docs/PARITA-FUNZIONALE.md`. La configurazione operativa
è in `docs/SETUP.md`; la consegna degli account è in `docs/HANDOVER.md`.

## Stack e costi

- Next.js su Netlify Free (consigliato) oppure altro hosting Node compatibile.
- Supabase Free per il database.
- Cloudflare Turnstile Free per l'anti-spam.
- Lo stesso Supabase applica il rate limit atomico, senza un account aggiuntivo.

Il codice non contiene credenziali, account o dipendenze runtime di Marco Costanza. I piani
gratuiti hanno limiti e possono cambiare: «zero euro oggi» non equivale a una garanzia contrattuale
di gratuità o disponibilità perpetua.

## Avvio locale

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Senza servizi e dati privacy configurati, l'app si costruisce ma gli invii e il login restano
chiusi. È una scelta di sicurezza.

`npm run test:db` esegue i controlli reali della migrazione su un PostgreSQL di prova già avviato
e indicato con `PGHOST`, `PGPORT` e `PGDATABASE`; non usa né modifica database esistenti.
