import "server-only";

import { prisma } from "@/lib/prisma";
import type { PaymentMethodCode } from "@/types";

const staleProcessingCutoff = () => new Date(Date.now() - 5 * 60_000);

export async function claimPaymentEvent(input: {
  provider: PaymentMethodCode;
  externalId: string;
  type: string;
  orderId?: string | null;
}) {
  const event = await prisma.paymentEvent.upsert({
    where: {
      provider_externalId: {
        provider: input.provider,
        externalId: input.externalId,
      },
    },
    create: input,
    update: input.orderId ? { orderId: input.orderId } : {},
    select: { id: true },
  });
  const claimed = await prisma.paymentEvent.updateMany({
    where: {
      id: event.id,
      OR: [
        { status: { in: ["RECEIVED", "FAILED"] } },
        { status: "PROCESSING", processingAt: { lt: staleProcessingCutoff() } },
      ],
    },
    data: {
      status: "PROCESSING",
      processingAt: new Date(),
      attempts: { increment: 1 },
      error: null,
    },
  });
  return claimed.count === 1 ? event.id : null;
}

export async function finishPaymentEvent(
  id: string,
  status: "PROCESSED" | "IGNORED" | "FAILED",
  error?: string,
) {
  await prisma.paymentEvent.update({
    where: { id },
    data: {
      status,
      processedAt: status === "FAILED" ? null : new Date(),
      processingAt: null,
      error: error?.slice(0, 2_000) ?? null,
    },
  });
}
