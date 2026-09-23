import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const required = ["PGHOST", "PGPORT", "PGDATABASE"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} non configurato per il database di prova.`);
}

function psql(sql, user = "service_role", expectSuccess = true) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", sql], {
      env: { ...process.env, PGUSER: user },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      const succeeded = code === 0;
      if (succeeded !== expectSuccess) {
        reject(new Error(`psql ${expectSuccess ? "fallito" : "riuscito inaspettatamente"}: ${stderr || stdout}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

await psql(
  "truncate public.qea_rate_limit_events, public.audience_question_archive_items, public.audience_question_archives, public.audience_questions restart identity cascade;",
  "postgres",
);

const concurrent = await Promise.all(Array.from({ length: 20 }, () => psql(
  `select allowed from public.check_rate_limit('question-submit','${hashA}',10,3600);`,
)));
assert.equal(concurrent.filter((value) => value === "t").length, 10);
assert.equal(concurrent.filter((value) => value === "f").length, 10);

assert.equal(await psql(`select allowed from public.check_rate_limit('question-submit','${hashB}',10,3600);`), "t");
assert.equal(await psql(`select allowed from public.check_rate_limit('admin-login','${hashA}',10,3600);`), "t");
await psql(`insert into public.qea_rate_limit_events(scope,identifier,created_at) values ('question-submit','${"c".repeat(64)}',clock_timestamp()-interval '2 hours');`);
assert.equal(await psql(`select allowed from public.check_rate_limit('question-submit','${"c".repeat(64)}',1,3600);`), "t");

for (const role of ["anon", "authenticated"]) {
  await psql("select count(*) from public.audience_questions;", role, false);
  await psql(`select * from public.check_rate_limit('question-submit','${hashB}',10,3600);`, role, false);
}

const source = "https://domande.example/QeA/invia";
await psql(`
  insert into public.audience_questions(question_text,status,published_at,rejected_at,ip_hash,source) values
    ('Domanda pending','pending',null,null,'${hashA}','${source}'),
    ('Domanda published','published',clock_timestamp(),null,'${hashA}','${source}'),
    ('Domanda saved','rejected',clock_timestamp()-interval '1 minute',clock_timestamp(),'${hashA}','${source}'),
    ('Domanda rejected','rejected',null,clock_timestamp(),'${hashA}','${source}');
`);
assert.equal(await psql("select count(*) from public.audience_questions;"), "4");

const transitionId = await psql(`insert into public.audience_questions(question_text,status,ip_hash,source) values ('Transizioni complete','pending','${hashB}','${source}') returning id;`);
await psql(`update public.audience_questions set status='published',published_at=clock_timestamp(),rejected_at=null where id='${transitionId}';`);
await psql(`update public.audience_questions set status='rejected',rejected_at=clock_timestamp() where id='${transitionId}';`);
assert.equal(await psql(`select (published_at is not null)::text from public.audience_questions where id='${transitionId}';`), "true");
await psql(`update public.audience_questions set status='published',published_at=clock_timestamp(),rejected_at=null where id='${transitionId}';`);
assert.equal(await psql(`select status from public.audience_questions where id='${transitionId}';`), "published");

const beforeRollback = await psql("select count(*) from public.audience_questions;");
const rollbackState = await psql("begin; select question_count from public.archive_all_audience_questions('Rollback'); rollback; select count(*) from public.audience_questions;");
assert.equal(rollbackState.split("\n").at(-1), beforeRollback);
assert.equal(await psql("select count(*) from public.audience_question_archives where name='Rollback';"), "0");

const archived = await psql("select archive_id,question_count from public.archive_all_audience_questions('Snapshot quattro bucket');");
const [archiveId, archiveCount] = archived.split("|");
assert.equal(Number(archiveCount), Number(beforeRollback));
assert.equal(await psql(`select string_agg(admin_bucket,',' order by admin_bucket) from (select distinct admin_bucket from public.audience_question_archive_items where archive_id='${archiveId}') b;`), "pending,published,rejected,saved");
assert.equal(await psql("select count(*) from public.audience_questions;"), "0");

await psql(`insert into public.audience_questions(question_text,status,ip_hash,source) values ('Prima del lock','pending','${hashA}','${source}');`);
const archiveWithLock = psql("begin; lock table public.audience_questions in share row exclusive mode; select pg_sleep(0.4); select archive_id from public.archive_all_audience_questions('Concorrenza'); commit;");
await new Promise((resolve) => setTimeout(resolve, 80));
const concurrentInsert = psql(`insert into public.audience_questions(question_text,status,ip_hash,source) values ('Arrivata durante archivio','pending','${hashB}','${source}');`);
await Promise.all([archiveWithLock, concurrentInsert]);
assert.equal(await psql("select count(*) from public.audience_questions where question_text='Arrivata durante archivio';"), "1");
assert.equal(await psql("select question_count from public.audience_question_archives where name='Concorrenza';"), "1");

const cascadeId = await psql("select id from public.audience_question_archives where name='Snapshot quattro bucket';");
assert.notEqual(await psql(`select count(*) from public.audience_question_archive_items where archive_id='${cascadeId}';`), "0");
await psql(`delete from public.audience_question_archives where id='${cascadeId}';`);
assert.equal(await psql(`select count(*) from public.audience_question_archive_items where archive_id='${cascadeId}';`), "0");

// Limite per telefono: stesso blocco atomico del limite per rete, conteggi separati.
const deviceHash = "d".repeat(64);
const deviceRuns = await Promise.all(Array.from({ length: 8 }, () => psql(
  `select allowed from public.check_rate_limit('question-device','${deviceHash}',3,900);`,
)));
assert.equal(deviceRuns.filter((value) => value === "t").length, 3);
assert.equal(await psql(`select allowed from public.check_rate_limit('question-submit','${deviceHash}',3,900);`), "t");
await psql("select * from public.check_rate_limit('question-inventato','" + deviceHash + "',3,900);", "service_role", false);

// Impostazioni: una sola riga, niente accesso dai ruoli pubblici, niente insert/delete.
assert.equal(await psql("select name_field||','||email_field||','||device_limit_max||','||device_limit_window_seconds from public.qea_settings;"), "off,off,3,3600");
for (const role of ["anon", "authenticated"]) {
  await psql("select * from public.qea_settings;", role, false);
  await psql("update public.qea_settings set name_field='required';", role, false);
}
await psql("insert into public.qea_settings(id) values (2);", "service_role", false);
await psql("delete from public.qea_settings;", "service_role", false);
await psql("update public.qea_settings set name_field='sempre';", "service_role", false);
await psql("update public.qea_settings set device_limit_window_seconds=7200;", "service_role", false);
await psql("update public.qea_settings set name_field='optional', email_field='required', device_limit_max=null;");
assert.equal(await psql("select name_field||','||email_field||','||coalesce(device_limit_max::text,'nessuno') from public.qea_settings;"), "optional,required,nessuno");
await psql("update public.qea_settings set name_field='off', email_field='off', device_limit_max=3, device_limit_window_seconds=3600;");

// Nome ed email: vincoli sul formato e copia nell'archivio.
await psql(`insert into public.audience_questions(question_text,status,ip_hash,source,display_name) values ('Nome corto','pending','${hashA}','${source}','A');`, "service_role", false);
await psql(`insert into public.audience_questions(question_text,status,ip_hash,source,contact_email) values ('Email storta','pending','${hashA}','${source}','non-una-email');`, "service_role", false);
await psql("truncate public.audience_questions;", "postgres");
await psql(`insert into public.audience_questions(question_text,status,ip_hash,source,display_name,contact_email) values ('Con identità','pending','${hashA}','${source}','Giulia Ferraris','giulia@example.com');`);
const namedArchive = await psql("select archive_id from public.archive_all_audience_questions('Con nomi');");
assert.equal(await psql(`select display_name||'|'||contact_email from public.audience_question_archive_items where archive_id='${namedArchive}';`), "Giulia Ferraris|giulia@example.com");

process.stdout.write("PASS DB: concorrenza 10/20, ruoli, scadenza, transizioni, rollback, lock, cascade, limite per telefono, impostazioni e nome/email\n");
