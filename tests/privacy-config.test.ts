import assert from "node:assert/strict";
import test from "node:test";
import { privacyConfig, publicSetupComplete } from "../lib/config.ts";

const names = [
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "DATA_CONTROLLER_NAME",
  "DATA_CONTROLLER_CONTACT",
  "DATA_PROCESSING_LEGAL_BASIS",
  "DATA_HOSTING_PROVIDER",
  "DATA_RETENTION_POLICY",
] as const;

test("gli invii restano chiusi finché tutta l'informativa non è confermata", () => {
  for (const name of names) delete process.env[name];
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
  process.env.DATA_CONTROLLER_NAME = "Titolare confermato";
  process.env.DATA_CONTROLLER_CONTACT = "privacy@example.test";
  assert.equal(privacyConfig().configured, false);
  assert.equal(publicSetupComplete(), false);

  process.env.DATA_PROCESSING_LEGAL_BASIS = "Base confermata dal titolare";
  process.env.DATA_HOSTING_PROVIDER = "Hosting confermato";
  process.env.DATA_RETENTION_POLICY = "Periodo e procedura confermati dal titolare";
  assert.equal(privacyConfig().configured, true);
  assert.equal(publicSetupComplete(), true);
});
