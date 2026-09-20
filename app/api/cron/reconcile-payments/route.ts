import { timingSafeEqual } from "node:crypto";

import { reconcileExpiredOrders } from "@/lib/payments/lifecycle";
import { reconcilePendingRefunds } from "@/lib/payments/refunds";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [orders, refunds] = await Promise.all([
    reconcileExpiredOrders(),
    reconcilePendingRefunds(),
  ]);
  const orderSummary = orders.reduce<Record<string, number>>((counts, result) => {
    counts[result.state] = (counts[result.state] ?? 0) + 1;
    return counts;
  }, {});
  const refundSummary = refunds.reduce<Record<string, number>>((counts, result) => {
    counts[result.state] = (counts[result.state] ?? 0) + 1;
    return counts;
  }, {});
  return Response.json({
    orders: { processed: orders.length, summary: orderSummary },
    refunds: { processed: refunds.length, summary: refundSummary },
  });
}
