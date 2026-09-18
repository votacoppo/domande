-- Il job gira una volta al giorno: una soglia interna di 29 giorni garantisce
-- che nessun dato raggiunga i 30 giorni anche nel caso peggiore tra due corse.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.qea_cleanup_expired_data(
  p_now timestamptz default clock_timestamp()
)
returns table (
  deleted_questions bigint,
  deleted_archive_items bigint,
  deleted_archives bigint,
  deleted_rate_events bigint
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_questions bigint;
  v_archive_items bigint;
  v_archives bigint;
  v_rate_events bigint;
begin
  delete from public.audience_questions
  where created_at < p_now - interval '29 days';
  get diagnostics v_questions = row_count;

  -- L'età dell'elemento resta quella della domanda originale: archiviare non
  -- riavvia il periodo di conservazione.
  delete from public.audience_question_archive_items
  where created_at < p_now - interval '29 days';
  get diagnostics v_archive_items = row_count;

  update public.audience_question_archives archive
  set question_count = items.actual_count
  from (
    select archive_id, count(*)::integer as actual_count
    from public.audience_question_archive_items
    group by archive_id
  ) items
  where archive.id = items.archive_id
    and archive.question_count <> items.actual_count;

  delete from public.audience_question_archives archive
  where archive.created_at < p_now - interval '29 days'
     or not exists (
       select 1
       from public.audience_question_archive_items item
       where item.archive_id = archive.id
     );
  get diagnostics v_archives = row_count;

  -- Anche qui la soglia è inferiore ai 2 giorni dichiarati, così la corsa
  -- giornaliera non può lasciare identificatori tecnici oltre il limite.
  delete from public.qea_rate_limit_events
  where created_at < p_now - interval '1 day';
  get diagnostics v_rate_events = row_count;

  return query select v_questions, v_archive_items, v_archives, v_rate_events;
end;
$$;

revoke all on function private.qea_cleanup_expired_data(timestamptz)
  from public, anon, authenticated, service_role;

-- Si passa sempre dall'API di pg_cron: nessuna scrittura diretta a cron.job.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'qea-retention-daily'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'qea-retention-daily',
  '17 3 * * *',
  $cron$
    select private.qea_cleanup_expired_data();

    delete from cron.job_run_details
    where end_time < now() - interval '30 days';
  $cron$
);
