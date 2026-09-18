import assert from "node:assert/strict";
import test from "node:test";
import { validateLogoutRequest } from "../lib/http/logout-handler.ts";

process.env.SITE_URL = "https://domande.example";

function request(origin: string, body = "{}"): Request {
  return new Request("https://domande.example/api/interno/auth/logout", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}

test("logout valido passa, CSRF e payload invalido sono respinti", async () => {
  assert.equal(await validateLogoutRequest(request("https://domande.example")), null);
  assert.equal((await validateLogoutRequest(request("https://evil.example")))?.status, 403);
  assert.equal((await validateLogoutRequest(request("https://domande.example", "{")))?.status, 400);
});
