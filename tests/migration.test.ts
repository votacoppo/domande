import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20260918085043_qea_schema.sql", import.meta.url), "utf8").toLowerCase();
const retentionSql = readFileSync(
  new URL("../supabase/migrations/20260918123614_qea_retention_30_days.sql", import.meta.url),
  "utf8",
).toLowerCase();
const strictRetentionSql = readFileSync(
  new URL("../supabase/migrations/20260918130114_qea_retention_strict_bound.sql", import.meta.url),
  "utf8",
).toLowerCase();
const rlsTriggerHardeningSql = readFileSync(
  new URL("../supabase/migrations/20260918130948_revoke_public_rls_trigger_execution.sql", import.meta.url),
  "utf8",
).toLowerCase();

test("migrazione protegge tutte le tabelle esposte", () => {
  for (const table of ["audience_questions", "audience_question_archives", "audience_question_archive_items", "qea_rate_limit_events"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
  }
});

test("RPC sensibili sono invoker e limitate al service role", () => {
  assert.equal(sql.includes("security definer"), false);
  assert.match(sql, /security invoker/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*v_now := clock_timestamp\(\)/);
  assert.match(sql, /lock table public\.audience_questions in share row exclusive mode/);
  assert.match(sql, /delete from public\.audience_questions where true/);
  assert.match(sql, /grant select, insert, update, delete on table public\.qea_rate_limit_events to service_role/);
  assert.match(sql, /grant execute on function public\.check_rate_limit[\s\S]*to service_role/);
});

test("eliminare un archivio elimina anche i suoi elementi", () => {
  assert.match(
    sql,
    /archive_id uuid not null references public\.audience_question_archives\(id\) on delete cascade/,
  );
  assert.match(
    sql,
    /grant select, insert, delete on table public\.audience_question_archives to service_role/,
  );
});

test("la conservazione è automatica in Supabase e non modifica cron.job direttamente", () => {
  assert.match(retentionSql, /create extension if not exists pg_cron/);
  assert.match(retentionSql, /cron\.schedule/);
  assert.match(strictRetentionSql, /private\.qea_cleanup_expired_data/);
  assert.match(strictRetentionSql, /audience_questions[\s\S]*interval '29 days'/);
  assert.match(strictRetentionSql, /audience_question_archive_items[\s\S]*interval '29 days'/);
  assert.match(strictRetentionSql, /qea_rate_limit_events[\s\S]*interval '1 day'/);
  assert.match(strictRetentionSql, /cron\.unschedule/);
  assert.match(strictRetentionSql, /cron\.schedule/);
  assert.equal(/(?:insert|update|delete)\s+(?:into\s+)?cron\.job\b/.test(retentionSql), false);
  assert.equal(/(?:insert|update|delete)\s+(?:into\s+)?cron\.job\b/.test(strictRetentionSql), false);
  assert.equal(strictRetentionSql.includes("security definer"), false);
});

test("la funzione automatica RLS non è invocabile dai ruoli API", () => {
  assert.match(rlsTriggerHardeningSql, /revoke execute on function public\.rls_auto_enable\(\)/);
  assert.match(rlsTriggerHardeningSql, /from public, anon, authenticated/);
});
