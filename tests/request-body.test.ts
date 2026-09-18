import assert from "node:assert/strict";
import test from "node:test";
import { readJsonBody } from "../lib/security/request.ts";

function streamedRequest(text: string, headers: Record<string, string> = {}): Request {
  const bytes = new TextEncoder().encode(text);
  return new Request("https://domande.example/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.subarray(0, Math.floor(bytes.length / 2)));
        controller.enqueue(bytes.subarray(Math.floor(bytes.length / 2)));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("legge un JSON valido dallo stream", async () => {
  const result = await readJsonBody(streamedRequest('{"ok":true}'));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, { ok: true });
});

test("rifiuta oltre 16 KB senza Content-Length prima del codice applicativo", async () => {
  let downstreamCalls = 0;
  const result = await readJsonBody(streamedRequest(JSON.stringify({ value: "x".repeat(17_000) })));
  if (result.ok) downstreamCalls += 1;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.response.status, 413);
  assert.equal(downstreamCalls, 0);
});

test("rifiuta il corpo reale oltre soglia anche con Content-Length ingannevole", async () => {
  const result = await readJsonBody(
    streamedRequest(JSON.stringify({ value: "x".repeat(17_000) }), { "content-length": "12" }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.response.status, 413);
});

test("rifiuta Content-Type e JSON non validi", async () => {
  const wrongType = await readJsonBody(new Request("https://domande.example/api", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  }));
  assert.equal(wrongType.ok, false);
  if (!wrongType.ok) assert.equal(wrongType.response.status, 400);

  const malformed = await readJsonBody(streamedRequest("{"));
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.response.status, 400);
});
