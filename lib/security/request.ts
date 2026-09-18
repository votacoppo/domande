import { siteUrl } from "../config.ts";

const MAX_JSON_BYTES = 16 * 1024;

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response };

function jsonRequestProblem(request: Request): Response | null {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return Response.json({ error: "Content-Type non valido." }, { status: 400 });
  }
  const rawLength = request.headers.get("content-length");
  if (rawLength && Number(rawLength) > MAX_JSON_BYTES) {
    return Response.json({ error: "Richiesta troppo grande." }, { status: 413 });
  }
  return null;
}

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const problem = jsonRequestProblem(request);
  if (problem) return { ok: false, response: problem };
  if (!request.body) {
    return { ok: false, response: Response.json({ error: "JSON non valido." }, { status: 400 }) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_JSON_BYTES) {
        await reader.cancel();
        return {
          ok: false,
          response: Response.json({ error: "Richiesta troppo grande." }, { status: 413 }),
        };
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return { ok: true, value: JSON.parse(decoded) as unknown };
  } catch {
    return { ok: false, response: Response.json({ error: "JSON non valido." }, { status: 400 }) };
  }
}

export function trustedOrigins(): Set<string> {
  const origins = new Set<string>();
  try {
    origins.add(new URL(siteUrl()).origin);
  } catch {
    // In produzione la mancanza viene trattata come configurazione non valida.
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return origins;
}

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return trustedOrigins().has(origin);
}

export function safeAdminRedirect(value: unknown): "/interno" | "/interno/domande" {
  return value === "/interno/domande" ? "/interno/domande" : "/interno";
}

export function mutationGuard(request: Request): Response | null {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ error: "Origine non autorizzata." }, { status: 403 });
  }
  return null;
}
