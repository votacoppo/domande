import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configura SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY senza stamparle.");

const client = createClient(url, key, { auth: { persistSession: false } });
const identifier = randomBytes(32).toString("hex");
const results = await Promise.all(Array.from({ length: 20 }, () => client.rpc("check_rate_limit", {
  p_scope: "question-submit",
  p_identifier: identifier,
  p_limit: 10,
  p_window_seconds: 3600,
})));
const errors = results.filter((result) => result.error);
if (errors.length) throw new Error(`RPC fallite: ${errors.length}`);
const allowed = results.flatMap((result) => result.data ?? []).filter((row) => row.allowed === true).length;
const blocked = results.flatMap((result) => result.data ?? []).filter((row) => row.allowed === false).length;
if (allowed !== 10 || blocked !== 10) throw new Error(`Concorrenza errata: ${allowed} ammesse, ${blocked} bloccate`);
process.stdout.write(`PASS: ${allowed} ammesse, ${blocked} bloccate\n`);
