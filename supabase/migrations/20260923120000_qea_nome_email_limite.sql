-- Nome pubblico ed email facoltativi, impostazioni del modulo e limite per dispositivo.
-- Solo aggiunte: il codice già in produzione continua a funzionare senza modifiche.

-- Nome ed email vivono sulla stessa riga della domanda: la conservazione a 30 giorni
-- li cancella insieme alla domanda senza toccare il job giornaliero.
alter table public.audience_questions
  add column display_name text
    check (display_name is null or char_length(display_name) between 2 and 80),
  add column contact_email text
    check (
      contact_email is null
      or (char_length(contact_email) between 6 and 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    );

alter table public.audience_question_archive_items
  add column display_name text
    check (display_name is null or char_length(display_name) between 2 and 80),
  add column contact_email text
    check (
      contact_email is null
      or (char_length(contact_email) between 6 and 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    );

-- Una sola riga di impostazioni: il vincolo su id impedisce di crearne una seconda.
create table public.qea_settings (
  id smallint primary key default 1 check (id = 1),
  name_field text not null default 'off' check (name_field in ('off', 'optional', 'required')),
  email_field text not null default 'off' check (email_field in ('off', 'optional', 'required')),
  device_limit_max integer check (device_limit_max is null or device_limit_max between 1 and 50),
  device_limit_window_seconds integer not null default 3600
    check (device_limit_window_seconds in (900, 3600, 10800, 86400)),
  updated_at timestamptz not null default now()
);

insert into public.qea_settings (id, name_field, email_field, device_limit_max, device_limit_window_seconds)
values (1, 'off', 'off', 3, 3600);

alter table public.qea_settings enable row level security;
revoke all on table public.qea_settings from public, anon, authenticated, service_role;
-- Il server può leggere e modificare la riga, mai cancellarla o duplicarla.
grant select, update on table public.qea_settings to service_role;

-- Nuovo tipo di conteggio per il limite legato al dispositivo.
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.qea_rate_limit_events'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%scope%'
  loop
    execute format('alter table public.qea_rate_limit_events drop constraint %I', v_constraint);
  end loop;
end;
$$;

alter table public.qea_rate_limit_events
  add constraint qea_rate_limit_events_scope_check
  check (scope in ('question-submit', 'question-device', 'admin-login'));

create or replace function public.check_rate_limit(
  p_scope text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer default 3600
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  v_oldest timestamptz;
  v_now timestamptz;
begin
  if p_scope not in ('question-submit', 'question-device', 'admin-login')
     or p_identifier !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 100
     or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT_INPUT';
  end if;

  -- La stessa chiave viene serializzata: venti richieste concorrenti non possono
  -- osservare tutte lo stesso conteggio e superare la soglia.
  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_identifier, 0));
  v_now := clock_timestamp();

  with expired as (
    select id
    from public.qea_rate_limit_events
    where created_at < v_now - interval '2 days'
    order by created_at
    limit 250
    for update skip locked
  )
  delete from public.qea_rate_limit_events e
  using expired
  where e.id = expired.id;

  select count(*), min(created_at)
    into v_count, v_oldest
  from public.qea_rate_limit_events
  where scope = p_scope
    and identifier = p_identifier
    and created_at > v_now - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from (
        v_oldest + make_interval(secs => p_window_seconds) - v_now
      )))::integer);
    return;
  end if;

  insert into public.qea_rate_limit_events (scope, identifier, created_at)
  values (p_scope, p_identifier, v_now);
  return query select true, 0;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer)
  to service_role;

-- Stessa logica di prima: l'archivio copia anche nome ed email.
create or replace function public.archive_all_audience_questions(p_name text)
returns table (archive_id uuid, question_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_archive_id uuid;
  v_count integer;
  v_name text := btrim(p_name);
begin
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'INVALID_NAME';
  end if;

  -- Blocca invii e moderazioni per la sola durata dello snapshot.
  lock table public.audience_questions in share row exclusive mode;
  select count(*) into v_count from public.audience_questions;
  if v_count = 0 then
    raise exception 'NO_QUESTIONS';
  end if;

  insert into public.audience_question_archives (name, question_count)
  values (v_name, v_count)
  returning id into v_archive_id;

  insert into public.audience_question_archive_items (
    archive_id, original_question_id, question_text, status, admin_bucket,
    created_at, published_at, rejected_at, display_name, contact_email
  )
  select
    v_archive_id,
    id,
    question_text,
    status,
    case
      when status = 'pending' then 'pending'
      when status = 'published' then 'published'
      when status = 'rejected' and published_at is not null then 'saved'
      else 'rejected'
    end,
    created_at,
    published_at,
    rejected_at,
    display_name,
    contact_email
  from public.audience_questions;

  delete from public.audience_questions where true;
  return query select v_archive_id, v_count;
end;
$$;

revoke all on function public.archive_all_audience_questions(text)
  from public, anon, authenticated;
grant execute on function public.archive_all_audience_questions(text)
  to service_role;
