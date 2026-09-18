import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.supabase.com";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(scriptDir, "../supabase/migrations");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Manca ${name}.`);
  return value;
}

const token = required("COPPO_SUPABASE_ACCESS_TOKEN");
const projectRef = required("COPPO_SUPABASE_PROJECT_REF");

async function query(sql, readOnly = true, parameters = []) {
  const suffix = readOnly ? "/read-only" : "";
  const response = await fetch(`${API}/v1/projects/${encodeURIComponent(projectRef)}/database/query${suffix}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql, parameters, read_only: readOnly }),
  });
  if (!response.ok) throw new Error(`Query Supabase HTTP ${response.status}.`);
  return response.json();
}

function rows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function localMigrations() {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort()
    .map((filename) => {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      return {
        filename,
        version: match[1],
        name: match[2],
        sql: readFileSync(resolve(migrationsDir, filename), "utf8"),
      };
    });
}

async function historyColumns() {
  const data = await query(`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
    order by ordinal_position;
  `);
  return rows(data);
}

async function appliedMigrations() {
  const data = await query(`
    select version, name, statements
    from supabase_migrations.schema_migrations
    order by version;
  `);
  return rows(data).map((row) => ({
    version: String(row.version),
    name: String(row.name),
    statements: row.statements,
  }));
}

function validateHistory(local, remote) {
  const localByVersion = new Map(local.map((migration) => [migration.version, migration]));
  for (const applied of remote) {
    const migration = localByVersion.get(applied.version);
    if (!migration) throw new Error(`Migrazione remota sconosciuta: ${applied.version}.`);
    if (applied.name !== migration.name) throw new Error(`Nome divergente per la migrazione ${applied.version}.`);
    if (!Array.isArray(applied.statements) || applied.statements.length !== 1 || applied.statements[0] !== migration.sql) {
      throw new Error(`SQL divergente per la migrazione ${applied.version}.`);
    }
  }
  return new Set(remote.map((migration) => migration.version));
}

async function status() {
  const columns = await historyColumns();
  const local = localMigrations();
  const applied = columns.length ? validateHistory(local, await appliedMigrations()) : new Set();
  process.stdout.write(`MIGRATION_HISTORY_COLUMNS=${columns.map((column) => column.column_name).join(",") || "assenti"}\n`);
  for (const migration of local) {
    process.stdout.write(`${migration.version} ${migration.name}: ${applied.has(migration.version) ? "applicata" : "pendente"}\n`);
  }
}

async function migrate() {
  const columns = await historyColumns();
  const requiredColumns = ["version", "statements", "name"];
  if (columns.length && !requiredColumns.every((name) => columns.some((column) => column.column_name === name))) {
    throw new Error("La tabella ufficiale delle migrazioni non ha la struttura attesa.");
  }

  const local = localMigrations();
  const applied = columns.length ? validateHistory(local, await appliedMigrations()) : new Set();
  for (const migration of local) {
    if (applied.has(migration.version)) continue;
    const statementBase64 = Buffer.from(migration.sql, "utf8").toString("base64");
    const version = migration.version.replaceAll("'", "''");
    const name = migration.name.replaceAll("'", "''");
    const wrapped = `
begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
revoke all on schema supabase_migrations from public, anon, authenticated;
revoke all on table supabase_migrations.schema_migrations from public, anon, authenticated;
${migration.sql}
insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '${version}',
  array[convert_from(decode('${statementBase64}', 'base64'), 'utf8')],
  '${name}'
);
commit;
`;
    await query(wrapped, false);
    process.stdout.write(`APPLICATA ${migration.version} ${migration.name}\n`);
  }

  const verifiedRows = await appliedMigrations();
  const verified = validateHistory(local, verifiedRows);
  const missing = local.filter((migration) => !verified.has(migration.version));
  if (missing.length) throw new Error(`Migrazioni non registrate: ${missing.map((item) => basename(item.filename)).join(", ")}`);
  process.stdout.write(`OK MIGRAZIONI: ${verified.size} versioni remote registrate\n`);
}

async function verify() {
  const data = await query(`
    select
      (select count(*) from information_schema.tables
       where table_schema = 'public'
         and table_name in ('audience_questions','audience_question_archives','audience_question_archive_items','qea_rate_limit_events')) as tables_count,
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname in ('audience_questions','audience_question_archives','audience_question_archive_items','qea_rate_limit_events')
         and c.relrowsecurity) as rls_count,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where (n.nspname, p.proname) in (('public','check_rate_limit'),('public','archive_all_audience_questions'),('private','qea_cleanup_expired_data'))) as functions_count,
      (select count(*) from cron.job where jobname = 'qea-retention-daily') as cron_count;
  `);
  const result = rows(data)[0];
  if (!result) throw new Error("Verifica Supabase senza risultato.");
  if (Number(result.tables_count) !== 4 || Number(result.rls_count) !== 4 || Number(result.functions_count) !== 3 || Number(result.cron_count) !== 1) {
    throw new Error("Schema Supabase incompleto o job di conservazione non corretto.");
  }
  process.stdout.write("OK SUPABASE: 4 tabelle, RLS 4/4, 3 funzioni, cron giornaliero unico\n");

  const cronData = await query(`
    select job.jobid, job.schedule, job.active, job.command,
      exists (
        select 1 from cron.job_run_details details
        where details.jobid = job.jobid and details.status = 'succeeded'
      ) as has_succeeded_run
    from cron.job job
    where job.jobname = 'qea-retention-daily';
  `);
  const cronJobs = rows(cronData);
  const cronJob = cronJobs[0];
  const normalizeSql = (value) => String(value).replace(/\s+/g, " ").trim().toLowerCase();
  if (
    cronJobs.length !== 1 ||
    cronJob.schedule !== "17 3 * * *" ||
    cronJob.active !== true ||
    normalizeSql(cronJob.command) !== normalizeSql(retentionCommand) ||
    cronJob.has_succeeded_run !== true
  ) {
    throw new Error("Il cron di conservazione non è attivo, non ha il comando atteso o non ha uno storico riuscito.");
  }
  process.stdout.write("OK CRON: attivo, comando esatto e almeno un'esecuzione riuscita\n");

  const advisorResponse = await fetch(`${API}/v1/projects/${encodeURIComponent(projectRef)}/advisors/security`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!advisorResponse.ok) throw new Error(`Security Advisor Supabase HTTP ${advisorResponse.status}.`);
  const advisorData = await advisorResponse.json();
  const findings = (advisorData?.lints ?? []).filter((lint) => ["WARN", "ERROR"].includes(lint.level));
  if (findings.length) {
    for (const finding of findings) {
      const schema = finding.metadata?.schema ?? "schema non indicato";
      const object = finding.metadata?.name ?? finding.metadata?.entity ?? "oggetto non indicato";
      process.stdout.write(`ADVISOR ${finding.level}: ${finding.name} (${schema}.${object})\n`);
    }
    throw new Error(`Security Advisor segnala ${findings.length} finding da risolvere.`);
  }
  process.stdout.write("OK SECURITY ADVISOR: nessun WARN o ERROR\n");
}

const retentionCommand = `
  select private.qea_cleanup_expired_data();
  delete from cron.job_run_details
  where end_time < now() - interval '30 days';
`;

async function cronProbe() {
  const startedAt = new Date().toISOString();
  let succeeded = false;
  try {
    await query(`select cron.schedule('qea-retention-daily', '* * * * *', $cron$${retentionCommand}$cron$);`, false);
    process.stdout.write("CRON_PROBE_STARTED\n");
    const deadline = Date.now() + 95_000;
    while (Date.now() < deadline) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000));
      const data = await query(`
        select details.status
        from cron.job job
        join cron.job_run_details details on details.jobid = job.jobid
        where job.jobname = 'qea-retention-daily'
          and details.start_time >= '${startedAt}'::timestamptz
        order by details.start_time desc
        limit 1;
      `);
      const status = rows(data)[0]?.status;
      if (status === "succeeded") {
        succeeded = true;
        break;
      }
      if (status === "failed") throw new Error("Il job di conservazione ha registrato un'esecuzione fallita.");
    }
    if (!succeeded) throw new Error("Il job di conservazione non si è concluso entro 95 secondi.");
  } finally {
    await query(`select cron.schedule('qea-retention-daily', '17 3 * * *', $cron$${retentionCommand}$cron$);`, false);
  }

  const finalData = await query(`
    select job.schedule,
      exists (
        select 1 from cron.job_run_details details
        where details.jobid = job.jobid and details.status = 'succeeded'
      ) as has_succeeded_run
    from cron.job job
    where job.jobname = 'qea-retention-daily';
  `);
  const finalJob = rows(finalData)[0];
  if (finalJob?.schedule !== "17 3 * * *" || !finalJob?.has_succeeded_run) {
    throw new Error("Il cron non è tornato alla pianificazione finale verificata.");
  }
  process.stdout.write("OK CRON: esecuzione reale riuscita e pianificazione finale 03:17 UTC\n");
}

const mode = process.argv[2];
try {
  if (mode === "status") await status();
  else if (mode === "migrate") await migrate();
  else if (mode === "verify") await verify();
  else if (mode === "cron-probe") await cronProbe();
  else throw new Error("Uso: node scripts/supabase-coppo.mjs <status|migrate|verify|cron-probe>");
} catch (error) {
  process.stderr.write(`ERRORE: ${error instanceof Error ? error.message : "operazione fallita"}\n`);
  process.exitCode = 1;
}
