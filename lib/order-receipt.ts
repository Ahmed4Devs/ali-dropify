import "server-only";

import { createHash } from "node:crypto";

export function orderReceiptCookieName(orderId: string) {
  return `order-receipt-${orderId}`;
}

export function hashOrderReceipt(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function receiptMatches(token: string | undefined, expectedHash: string) {
  return Boolean(token) && hashOrderReceipt(token as string) === expectedHash;
}
