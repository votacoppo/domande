import { randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "../../../..");
const setSecret = resolve(workspaceRoot, "Costanza-SMM/scripts/security/env-set-secret.sh");
const secretReader = resolve(workspaceRoot, "Costanza-SMM/scripts/security/segreto.sh");
const credentialNames = [
  "COPPO_ADMIN_DASHBOARD_PASSWORD",
  "COPPO_ADMIN_PASSWORD_HASH",
  "COPPO_ADMIN_SESSION_SECRET",
  "COPPO_ADMIN_SESSION_EPOCH",
  "COPPO_IP_HASH_SECRET",
];

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  throw new Error("Generazione consentita solo in un terminale interattivo: nessuna credenziale è stata modificata.");
}

const namesResult = spawnSync(secretReader, ["--nomi"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
if (namesResult.status !== 0) throw new Error("Impossibile verificare le credenziali esistenti.");
const existingNames = new Set(namesResult.stdout.split(/\s+/).filter(Boolean));
const alreadyPresent = credentialNames.filter((name) => existingNames.has(name));
if (alreadyPresent.length) {
  throw new Error("L'accesso Coppo esiste già: generazione interrotta senza modifiche. La rotazione è un'operazione separata.");
}

function pick(alphabet) {
  return alphabet[randomBytes(1)[0] % alphabet.length];
}

function shuffledPassword() {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = `${lower}${upper}${digits}`;
  const chars = [pick(lower), pick(upper), pick(digits), "!"];
  while (chars.length < 20) chars.push(pick(all));
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomBytes(1)[0] % (index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
}

function save(name, value) {
  const result = spawnSync(setSecret, [name, "--stdin"], {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "ignore", "inherit"],
  });
  if (result.status !== 0) throw new Error(`Impossibile salvare ${name}.`);
}

const password = shuffledPassword();
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

save(credentialNames[0], password);
save(credentialNames[1], passwordHash);
save(credentialNames[2], randomBytes(48).toString("base64url"));
save(credentialNames[3], "1");
save(credentialNames[4], randomBytes(48).toString("base64url"));

process.stdout.write("\nACCESSO DASHBOARD DA CONSEGNARE A MARCELLO\n");
process.stdout.write("Email: votacoppodomande@gmail.com\n");
process.stdout.write(`Password: ${password}\n`);
process.stdout.write("\nCopialo ora in un gestore password: questa stampa non viene salvata in file.\n");
