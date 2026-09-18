import { randomBytes, scryptSync } from "node:crypto";
import process from "node:process";

function leggiPasswordMascherata(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Esegui questo comando in un terminale interattivo."));
      return;
    }
    process.stdout.write(prompt);
    const chunks = [];
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\u0003") process.exit(130);
      if (char === "\r" || char === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(chunks.join(""));
      } else if (char === "\u007f") {
        chunks.pop();
      } else {
        chunks.push(char);
      }
    };
    process.stdin.on("data", onData);
  });
}

try {
  const password = await leggiPasswordMascherata("Password dashboard (minimo 14 caratteri): ");
  if (password.length < 14) throw new Error("Password troppo corta.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  process.stdout.write("\nCopia direttamente nelle variabili protette dell’hosting:\n");
  process.stdout.write(`ADMIN_PASSWORD_HASH=${salt}:${hash}\n`);
  process.stdout.write(`ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64url")}\n`);
  process.stdout.write(`IP_HASH_SECRET=${randomBytes(48).toString("base64url")}\n`);
  process.stdout.write("ADMIN_SESSION_EPOCH=1\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Errore"}\n`);
  process.exitCode = 1;
}
