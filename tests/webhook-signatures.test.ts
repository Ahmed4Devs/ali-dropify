import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  verifyLemonSqueezySignature,
  verifyPaddleSignature,
} from "../lib/payments/webhook-signatures";

test("verifies Lemon Squeezy HMAC signatures without changing the raw body", () => {
  const rawBody = '{"meta":{"event_name":"order_created"}}';
  const secret = "lemon-webhook-secret";
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.equal(verifyLemonSqueezySignature(rawBody, signature, secret), true);
  assert.equal(verifyLemonSqueezySignature(`${rawBody}\n`, signature, secret), false);
  assert.equal(verifyLemonSqueezySignature(rawBody, "invalid", secret), false);
});

test("verifies Paddle timestamped signatures and rejects stale requests", () => {
  const rawBody = '{"event_id":"evt_123"}';
  const secret = "paddle-webhook-secret";
  const timestamp = 1_800_000_000;
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}:${rawBody}`)
    .digest("hex");
  const header = `ts=${timestamp};h1=${signature}`;

  assert.equal(verifyPaddleSignature(rawBody, header, secret, timestamp * 1_000), true);
  assert.equal(verifyPaddleSignature(rawBody, header, secret, (timestamp + 6) * 1_000), false);
  assert.equal(verifyPaddleSignature("{}", header, secret, timestamp * 1_000), false);
});
