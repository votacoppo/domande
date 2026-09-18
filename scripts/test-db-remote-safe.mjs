import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

for (const name of ["COPPO_SUPABASE_ACCESS_TOKEN", "COPPO_SUPABASE_PROJECT_REF"]) {
  if (!process.env[name]) throw new Error(`${name} non configurato.`);
}

const endpoint = `https://api.supabase.com/v1/projects/${encodeURIComponent(process.env.COPPO_SUPABASE_PROJECT_REF)}/database/query`;

async function query(sql, expectSuccess = true) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.COPPO_SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql, read_only: false }),
  });
  if (response.ok !== expectSuccess) {
    throw new Error(`Query Supabase ${expectSuccess ? "fallita" : "riuscita inaspettatamente"}: HTTP ${response.status}.`);
  }
  if (!response.ok) return null;
  return response.json();
}

function rows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

for (const role of ["anon", "authenticated"]) {
  await query(`begin; set local role ${role}; select count(*) from public.audience_questions; rollback;`, false);
}

const marker = randomBytes(16).toString("hex");
const rateIdentifier = randomBytes(32).toString("hex");
const ipHash = randomBytes(32).toString("hex");
const source = `https://remote-safe.invalid/${marker}`;

try {
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      query(`select allowed from public.check_rate_limit('question-submit','${rateIdentifier}',10,3600);`),
    ),
  );
  const allowed = results.map((result) => Boolean(rows(result)[0]?.allowed));
  assert.equal(allowed.filter(Boolean).length, 10);
  assert.equal(allowed.filter((value) => !value).length, 10);

  const transactionResult = await query(`
begin;

insert into public.audience_questions
  (question_text, status, ip_hash, source, created_at)
values
  ('${marker}-old-question', 'pending', '${ipHash}', '${source}', clock_timestamp() - interval '30 days'),
  ('${marker}-new-question', 'pending', '${ipHash}', '${source}', clock_timestamp());

with new_archive as (
  insert into public.audience_question_archives (name, question_count, created_at)
  values ('${marker}-archive', 2, clock_timestamp())
  returning id
)
insert into public.audience_question_archive_items
  (archive_id, question_text, status, admin_bucket, created_at)
select id, '${marker}-old-item', 'pending', 'pending', clock_timestamp() - interval '30 days'
from new_archive
union all
select id, '${marker}-new-item', 'pending', 'pending', clock_timestamp()
from new_archive;

insert into public.qea_rate_limit_events (scope, identifier, created_at)
values
  ('question-submit', '${ipHash}', clock_timestamp() - interval '2 days'),
  ('question-submit', '${ipHash}', clock_timestamp());

select * from private.qea_cleanup_expired_data(clock_timestamp());

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.audience_questions
  where source = '${source}' and question_text like '%old-question';
  if v_count <> 0 then raise exception 'OLD_QUESTION_NOT_DELETED'; end if;

  select count(*) into v_count from public.audience_questions
  where source = '${source}' and question_text like '%new-question';
  if v_count <> 1 then raise exception 'NEW_QUESTION_NOT_RETAINED'; end if;

  select count(*) into v_count from public.audience_question_archive_items
  where question_text = '${marker}-old-item';
  if v_count <> 0 then raise exception 'OLD_ARCHIVE_ITEM_NOT_DELETED'; end if;

  select question_count into v_count from public.audience_question_archives
  where name = '${marker}-archive';
  if v_count <> 1 then raise exception 'ARCHIVE_COUNT_NOT_UPDATED'; end if;

  select count(*) into v_count from public.qea_rate_limit_events
  where identifier = '${ipHash}' and created_at < clock_timestamp() - interval '1 day';
  if v_count <> 0 then raise exception 'OLD_RATE_EVENT_NOT_DELETED'; end if;
end;
$$;

rollback;
select 'REMOTE_SAFE_OK' as marker;
`);
  assert.equal(rows(transactionResult)[0]?.marker, "REMOTE_SAFE_OK");
} finally {
  await query(`delete from public.qea_rate_limit_events where identifier = '${rateIdentifier}';`);
}

assert.equal(
  Number(rows(await query(`select count(*) from public.qea_rate_limit_events where identifier = '${rateIdentifier}';`))[0]?.count),
  0,
);

process.stdout.write("PASS DB REMOTO: RLS, concorrenza, conservazione e rollback isolato\n");
