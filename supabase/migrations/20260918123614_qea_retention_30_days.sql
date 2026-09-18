-- Conservazione verificabile nel database: nessun job esterno o servizio a pagamento.
-- Supabase Cron usa pg_cron; non si fissa la versione dell'estensione perché la piattaforma
-- installa automaticamente quella corrente supportata.
create extension if not exists pg_cron;

select cron.schedule(
  'qea-retention-daily',
  '17 3 * * *',
  $cron$
    delete from public.audience_questions
    where created_at < now() - interval '30 days';

    delete from public.audience_question_archives
    where created_at < now() - interval '30 days';

    delete from public.qea_rate_limit_events
    where created_at < now() - interval '2 days';

    delete from cron.job_run_details
    where end_time < now() - interval '30 days';
  $cron$
);
