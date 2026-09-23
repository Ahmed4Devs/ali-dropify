type StoredStripeRefund = {
  orderId: string;
  provider: string;
  providerRef: string | null;
  amount: number;
  currency: string;
};

type StripeRefundEvent = {
  id: string;
  metadata: { orderId?: string } | null;
  amount: number;
  currency: string;
  payment_intent: string | { id: string } | null;
};

export function matchesStripeRefund(
  refund: StripeRefundEvent,
  order: { id: string; paymentMethod: string | null; paymentRef: string | null },
  requested: StoredStripeRefund | null,
) {
  const paymentIntent = typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id;
  return Boolean(
    requested &&
    order.paymentMethod === "STRIPE" &&
    requested.provider === "STRIPE" &&
    requested.orderId === order.id &&
    refund.metadata?.orderId === order.id &&
    refund.amount === requested.amount &&
    refund.currency.toUpperCase() === requested.currency &&
    ((paymentIntent && paymentIntent === order.paymentRef) || requested.providerRef === refund.id) &&
    (!requested.providerRef || requested.providerRef === refund.id),
  );
}
