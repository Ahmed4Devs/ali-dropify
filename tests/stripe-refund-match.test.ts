import assert from "node:assert/strict";
import test from "node:test";
import { matchesStripeRefund } from "../lib/payments/stripe-refund-match";

const order = { id: "order-1", paymentMethod: "STRIPE", paymentRef: "pi_order_1" };
const requested = {
  orderId: order.id,
  provider: "STRIPE",
  providerRef: "re_valid",
  amount: 12500,
  currency: "USD",
};
const event = {
  id: "re_valid",
  metadata: { orderId: order.id },
  amount: 12500,
  currency: "usd",
  payment_intent: "pi_order_1",
};

test("accepts the requested Stripe refund for the paid order", () => {
  assert.equal(matchesStripeRefund(event, order, requested), true);
});

test("rejects a refund with matching metadata but a different amount or payment", () => {
  assert.equal(matchesStripeRefund({ ...event, amount: 100 }, order, requested), false);
  assert.equal(
    matchesStripeRefund({ ...event, payment_intent: "pi_other" }, order, { ...requested, providerRef: null }),
    false,
  );
  assert.equal(matchesStripeRefund({ ...event, currency: "eur" }, order, requested), false);
});

test("rejects refunds not requested for this order", () => {
  assert.equal(matchesStripeRefund(event, order, null), false);
  assert.equal(matchesStripeRefund({ ...event, id: "re_other" }, order, requested), false);
  assert.equal(matchesStripeRefund({ ...event, metadata: { orderId: "order-2" } }, order, requested), false);
  assert.equal(matchesStripeRefund(event, { ...order, paymentMethod: "PAYPAL" }, requested), false);
});

test("accepts a refund event that arrived before its provider reference was saved", () => {
  assert.equal(matchesStripeRefund(event, order, { ...requested, providerRef: null }), true);
  assert.equal(
    matchesStripeRefund(event, { ...order, paymentRef: "cs_legacy" }, { ...requested, providerRef: null }),
    false,
  );
  assert.equal(
    matchesStripeRefund(event, { ...order, paymentRef: "cs_legacy" }, requested),
    true,
  );
});
