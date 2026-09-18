import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionToken, readSessionToken } from "../lib/auth/session-token.ts";

const secret = "q".repeat(48);
const common = { secret, epoch: "1", expectedEmail: "admin@example.test" };

test("sessione valida e legata a email/epoch/scadenza", () => {
  const token = buildSessionToken({ email: common.expectedEmail, secret, epoch: "1", now: 1000, ttlMs: 5000 });
  assert.ok(readSessionToken({ ...common, token, now: 2000 }));
  assert.equal(readSessionToken({ ...common, token, now: 7000 }), null);
  assert.equal(readSessionToken({ ...common, token, epoch: "2", now: 2000 }), null);
  assert.equal(readSessionToken({ ...common, token, expectedEmail: "other@example.test", now: 2000 }), null);
});

test("rifiuta token alterato", () => {
  const token = buildSessionToken({ email: common.expectedEmail, secret, epoch: "1", now: 1000 });
  assert.equal(readSessionToken({ ...common, token: `${token}x`, now: 2000 }), null);
});
