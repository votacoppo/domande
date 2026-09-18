create extension if not exists pgcrypto;

create table public.audience_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null check (char_length(question_text) between 3 and 500),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  rejected_at timestamptz,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  source text not null check (char_length(source) between 1 and 2048),
  constraint audience_questions_state_check check (
    (status = 'pending' and published_at is null and rejected_at is null)
    or (status = 'published' and published_at is not null and rejected_at is null)
    or (status = 'rejected' and rejected_at is not null)
  )
);

create index audience_questions_status_created_idx
  on public.audience_questions (status, created_at desc);
create index audience_questions_published_idx
  on public.audience_questions (published_at desc)
  where status = 'published';

create table public.audience_question_archives (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  question_count integer not null check (question_count > 0)
);

create table public.audience_question_archive_items (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.audience_question_archives(id) on delete cascade,
  original_question_id uuid,
  question_text text not null check (char_length(question_text) between 3 and 500),
  status text not null check (status in ('pending', 'published', 'rejected')),
  admin_bucket text not null check (admin_bucket in ('pending', 'published', 'saved', 'rejected')),
  created_at timestamptz not null,
  published_at timestamptz,
  rejected_at timestamptz
);

create index audience_question_archive_items_archive_idx
  on public.audience_question_archive_items (archive_id, created_at desc);

-- Solo identificatori HMAC: l'indirizzo IP grezzo non entra mai nel database.
create table public.qea_rate_limit_events (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('question-submit', 'admin-login')),
  identifier text not null check (identifier ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);

create index qea_rate_limit_lookup_idx
  on public.qea_rate_limit_events (scope, identifier, created_at);
create index qea_rate_limit_cleanup_idx
  on public.qea_rate_limit_events (created_at);

alter table public.audience_questions enable row level security;
alter table public.audience_question_archives enable row level security;
alter table public.audience_question_archive_items enable row level security;
alter table public.qea_rate_limit_events enable row level security;

revoke all on table public.audience_questions from public, anon, authenticated;
revoke all on table public.audience_question_archives from public, anon, authenticated;
revoke all on table public.audience_question_archive_items from public, anon, authenticated;
revoke all on table public.qea_rate_limit_events from public, anon, authenticated;

grant select, insert, update, delete on table public.audience_questions to service_role;
grant select, insert, delete on table public.audience_question_archives to service_role;
grant select, insert, delete on table public.audience_question_archive_items to service_role;
grant select, insert, update, delete on table public.qea_rate_limit_events to service_role;
grant usage, select on sequence public.qea_rate_limit_events_id_seq to service_role;

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
  if p_scope not in ('question-submit', 'admin-login')
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
    created_at, published_at, rejected_at
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
    rejected_at
  from public.audience_questions;

  delete from public.audience_questions where true;
  return query select v_archive_id, v_count;
end;
$$;

revoke all on function public.archive_all_audience_questions(text)
  from public, anon, authenticated;
grant execute on function public.archive_all_audience_questions(text)
  to service_role;
