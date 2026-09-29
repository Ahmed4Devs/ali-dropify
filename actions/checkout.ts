"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/dal";
import { getCurrencyRate } from "@/lib/currency";
import { assertPaymentMethodConfigured, getPaymentAdapter } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { CurrencyCode, OrderForPayment, PaymentMethodCode } from "@/types";
import { hashOrderReceipt, orderReceiptCookieName } from "@/lib/order-receipt";
import { isPaymentCreationUncertainError } from "@/lib/payments/errors";
import { reconcilePendingOrder } from "@/lib/payments/lifecycle";
import {
  isInventoryAvailable,
  releaseOrderInventory,
  reserveCartInventory,
} from "@/lib/inventory";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSupportedShippingCountry, SAUDI_SHIPPING_COUNTRY } from "@/lib/shipping-destination";

const checkoutSchema = z.object({
  checkoutKey: z.uuid(),
  receiptToken: z.string().regex(/^[a-f0-9]{64}$/),
  locale: z.enum(["en", "ar"]),
  currency: z.enum(["USD", "SAR", "AUD"]),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  fullName: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  street: z.string().trim().min(3).max(160),
  apartment: z.string().trim().max(100).optional(),
  zip: z.string().trim().min(2).max(20),
  paymentMethod: z.enum(["STRIPE", "MOYASAR", "PAYPAL"]),
});

export async function placeOrderAction(input: z.input<typeof checkoutSchema>) {
  const parsed = checkoutSchema.safeParse(input);
  const locale = parsed.success ? parsed.data.locale : input.locale === "ar" ? "ar" : "en";
  const t = await getTranslations({ locale, namespace: "checkout.errors" });
  if (!parsed.success) return { ok: false as const, error: t("details") };
  if (!isSupportedShippingCountry(parsed.data.country)) {
    return { ok: false as const, error: t("shippingCountryUnavailable") };
  }
  const validMethods: Record<CurrencyCode, PaymentMethodCode[]> = {
    USD: ["STRIPE", "PAYPAL"],
    SAR: ["STRIPE", "MOYASAR"],
    AUD: ["STRIPE", "PAYPAL"],
  };
  if (!validMethods[parsed.data.currency].includes(parsed.data.paymentMethod)) {
    return { ok: false as const, error: t("paymentUnavailable") };
  }

  try {
    if (!await consumeRateLimit("checkout", 10, 10 * 60)) {
      return { ok: false as const, error: t("rateLimited") };
    }
    assertPaymentMethodConfigured(parsed.data.paymentMethod);
    const session = await getSession();
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("guest-cart")?.value;
    const receiptTokenHash = hashOrderReceipt(parsed.data.receiptToken);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    let order = await prisma.order.findUnique({
      where: { checkoutKey: parsed.data.checkoutKey },
      include: { items: true },
    });
    if (order) {
      const ownedByUser = order.userId ? order.userId === session?.user.id : true;
      if (!ownedByUser || order.receiptTokenHash !== receiptTokenHash) {
        return { ok: false as const, error: t("attemptUnavailable") };
      }
      if (
        order.currency !== parsed.data.currency ||
        order.paymentMethod !== parsed.data.paymentMethod
      ) {
        const creationNeverStarted = !order.paymentCreatingAt && !order.paymentLeaseToken;
        if (!order.paymentUrl && order.status === "PENDING" && creationNeverStarted) {
          const existingOrderId = order.id;
          const existingCheckoutKey = order.checkoutKey;
          await prisma.$transaction(async (transaction) => {
            const cancelled = await transaction.order.updateMany({
              where: {
                id: existingOrderId,
                status: "PENDING",
                paymentUrl: null,
                paymentCreatingAt: null,
                paymentLeaseToken: null,
              },
              data: { status: "CANCELLED" },
            });
            if (cancelled.count === 1) {
              await releaseOrderInventory(transaction, existingOrderId);
              await transaction.cart.updateMany({
                where: { activeCheckoutKey: existingCheckoutKey },
                data: { activeCheckoutKey: null },
              });
            }
          });
        }
        return { ok: false as const, error: t("attemptChanged") };
      }
      if (!session?.user.id) {
        cookieStore.set(orderReceiptCookieName(order.id), parsed.data.receiptToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: `/${parsed.data.locale}/checkout/success`,
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      if (
        order.status === "PENDING" &&
        order.paymentUrl &&
        order.paymentExpiresAt &&
        order.paymentExpiresAt <= new Date()
      ) {
        const reconciled = await reconcilePendingOrder(order.id, { cancel: true, force: true });
        if (reconciled.state === "cancelled") {
          return { ok: false as const, error: t("attemptExpired"), resetAttempt: true as const };
        }
        if (reconciled.state === "unknown") {
          return { ok: false as const, error: t("paymentPreparing") };
        }
        order = await prisma.order.findUnique({
          where: { id: order.id },
          include: { items: true },
        });
        if (!order) return { ok: false as const, error: t("attemptUnavailable") };
      }
      if (order.paymentUrl && order.status === "PENDING") {
        return { ok: true as const, data: { redirectUrl: order.paymentUrl, orderId: order.id } };
      }
      if (order.status === "CANCELLED") {
        return { ok: false as const, error: t("attemptExpired"), resetAttempt: true as const };
      }
      if (order.status !== "PENDING") {
        return {
          ok: true as const,
          data: {
            redirectUrl: `${appUrl}/${parsed.data.locale}/checkout/success?order=${order.id}`,
            orderId: order.id,
          },
        };
      }
    }
    const cart = await prisma.cart.findFirst({
      where: session?.user.id ? { userId: session.user.id } : token ? { sessionToken: token } : { id: "missing" },
      include: { items: { include: { product: { include: { variants: true } }, variant: true } } },
    });
    if (!cart?.items.length) return { ok: false as const, error: t("empty") };
    if (cart.activeCheckoutKey && cart.activeCheckoutKey !== parsed.data.checkoutKey) {
      const activeOrder = await prisma.order.findUnique({
        where: { checkoutKey: cart.activeCheckoutKey },
        select: {
          id: true,
          status: true,
          paymentUrl: true,
          paymentCreatingAt: true,
          paymentLeaseToken: true,
          providerCheckoutId: true,
          paymentExpiresAt: true,
          paymentRef: true,
          paymentMethod: true,
          currency: true,
          total: true,
        },
      });
      if (activeOrder?.status === "PENDING" && activeOrder.paymentUrl) {
        if (activeOrder.paymentExpiresAt && activeOrder.paymentExpiresAt <= new Date()) {
          const reconciled = await reconcilePendingOrder(activeOrder.id, { cancel: true, force: true });
          if (reconciled.state === "cancelled") {
            cart.activeCheckoutKey = null;
          } else if (reconciled.state === "paid") {
            return {
              ok: true as const,
              data: {
                redirectUrl: `${appUrl}/${parsed.data.locale}/checkout/success?order=${activeOrder.id}`,
                orderId: activeOrder.id,
              },
            };
          } else {
            return { ok: false as const, error: t("activeAttempt") };
          }
        } else {
          return {
            ok: true as const,
            data: { redirectUrl: activeOrder.paymentUrl, orderId: activeOrder.id },
          };
        }
      }
      if (cart.activeCheckoutKey) {
        const creationNeverStarted = !activeOrder?.paymentCreatingAt &&
          !activeOrder?.paymentLeaseToken;
        if (activeOrder?.status === "PENDING" && !activeOrder.paymentUrl && creationNeverStarted) {
          const activeCheckoutKey = cart.activeCheckoutKey;
          const cancelled = await prisma.$transaction(async (transaction) => {
            const transition = await transaction.order.updateMany({
              where: {
                id: activeOrder.id,
                status: "PENDING",
                paymentUrl: null,
                paymentCreatingAt: null,
                paymentLeaseToken: null,
              },
              data: { status: "CANCELLED" },
            });
            if (transition.count !== 1) return false;
            await releaseOrderInventory(transaction, activeOrder.id);
            await transaction.cart.updateMany({
              where: { id: cart.id, activeCheckoutKey },
              data: { activeCheckoutKey: null },
            });
            return true;
          });
          if (!cancelled) return { ok: false as const, error: t("activeAttempt") };
          cart.activeCheckoutKey = null;
        } else {
          return { ok: false as const, error: t("activeAttempt") };
        }
      }
    }
    if (cart.items.some((item) =>
      (item.product.variants.length > 0 && !item.variant) ||
      !isInventoryAvailable(item)
    )) {
      return { ok: false as const, error: t("stockChanged") };
    }
    if (!order) {
      try {
        order = await prisma.$transaction(async (transaction) => {
          const claim = await transaction.cart.updateMany({
            where: {
              id: cart.id,
              OR: [
                { activeCheckoutKey: null },
                { activeCheckoutKey: parsed.data.checkoutKey },
              ],
            },
            data: { activeCheckoutKey: parsed.data.checkoutKey },
          });
          if (claim.count !== 1) throw new Error("CHECKOUT_ALREADY_ACTIVE");
          const claimedCart = await transaction.cart.findUnique({
            where: { id: cart.id },
            include: {
              items: {
                include: {
                  product: { include: { variants: true } },
                  variant: true,
                },
              },
            },
          });
          if (!claimedCart?.items.length) throw new Error("CHECKOUT_CART_EMPTY");
          if (claimedCart.items.some((item) =>
            (item.product.variants.length > 0 && !item.variant) ||
            !isInventoryAvailable(item)
          )) throw new Error("CHECKOUT_STOCK_CHANGED");

          const reservations = await reserveCartInventory(transaction, claimedCart.items);
          const hasReservations = [...reservations.values()].some((quantity) => quantity > 0);

          const settings = await transaction.storeSetting.findUnique({ where: { id: "main" } });
          const sar = Number(settings?.sarPerUsd ?? 3.75);
          const aud = Number(settings?.audPerUsd ?? 1.55);
          const fxRate = getCurrencyRate(parsed.data.currency, sar, aud);
          const subtotalUsd = claimedCart.items.reduce(
            (sum, item) => sum + (item.variant?.priceUsd ?? item.product.priceUsd) * item.quantity,
            0,
          );
          const chargedItems = claimedCart.items.map((item) => ({
            item,
            unitPrice: Math.round((item.variant?.priceUsd ?? item.product.priceUsd) * fxRate),
          }));
          const threshold = settings?.freeShippingMinUsd;
          const shippingUsd = threshold !== null && threshold !== undefined && subtotalUsd >= threshold
            ? 0
            : settings?.shippingFlatUsd ?? 499;
          const subtotal = chargedItems.reduce(
            (sum, entry) => sum + entry.unitPrice * entry.item.quantity,
            0,
          );
          const shippingFee = Math.round(shippingUsd * fxRate);
          const orderNumber = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
          const address = {
            fullName: parsed.data.fullName,
            phone: parsed.data.phone,
            country: SAUDI_SHIPPING_COUNTRY,
            state: parsed.data.state,
            city: parsed.data.city,
            street: parsed.data.street,
            apartment: parsed.data.apartment,
            zip: parsed.data.zip,
          };
          return transaction.order.create({
            data: {
              orderNumber,
              checkoutKey: parsed.data.checkoutKey,
              receiptTokenHash,
              userId: session?.user.id,
              email: parsed.data.email,
              phone: parsed.data.phone,
              currency: parsed.data.currency,
              fxRate,
              subtotal,
              shippingFee,
              total: subtotal + shippingFee,
              paymentMethod: parsed.data.paymentMethod,
              shippingAddress: address,
              inventoryState: hasReservations ? "RESERVED" : "NOT_TRACKED",
              items: {
                create: chargedItems.map(({ item, unitPrice }) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  titleEn: item.product.titleEn,
                  titleAr: item.product.titleAr,
                  image: item.product.images[0],
                  variant: item.variant
                    ? (item.variant.options as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                  unitPrice,
                  unitCostUsd: item.variant?.costUsd ?? item.product.costUsd,
                  supplierUrl: item.product.aliexpressUrl,
                  supplierProductId: item.product.aliexpressProductId,
                  supplierSkuId: item.variant?.aliexpressSkuId ?? null,
                  quantity: item.quantity,
                  inventoryReserved: reservations.get(item.id) ?? 0,
                })),
              },
            },
            include: { items: true },
          });
        });
      } catch (error) {
        if (error instanceof Error && error.message === "CHECKOUT_ALREADY_ACTIVE") {
          return { ok: false as const, error: t("activeAttempt") };
        }
        if (error instanceof Error && error.message === "CHECKOUT_CART_EMPTY") {
          return { ok: false as const, error: t("empty") };
        }
        if (error instanceof Error && error.message === "CHECKOUT_STOCK_CHANGED") {
          return { ok: false as const, error: t("stockChanged") };
        }
        const duplicate = error instanceof Error && "code" in error && error.code === "P2002";
        if (!duplicate) throw error;
        order = await prisma.order.findUnique({
          where: { checkoutKey: parsed.data.checkoutKey },
          include: { items: true },
        });
        if (!order || order.receiptTokenHash !== receiptTokenHash) throw error;
      }
      if (!session?.user.id) {
        cookieStore.set(orderReceiptCookieName(order.id), parsed.data.receiptToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: `/${parsed.data.locale}/checkout/success`,
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }
    const paymentLeaseToken = randomUUID();
    const leaseCutoff = new Date(Date.now() - 5 * 60_000);
    const canReclaimExpiredLease = !["MOYASAR"].includes(
      order.paymentMethod ?? "",
    );
    const lease = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
        paymentUrl: null,
        OR: canReclaimExpiredLease
          ? [
              { paymentCreatingAt: null, paymentLeaseToken: null },
              {
                paymentCreatingAt: { lt: leaseCutoff },
                paymentLeaseToken: { not: null },
              },
            ]
          : [{ paymentCreatingAt: null, paymentLeaseToken: null }],
      },
      data: { paymentCreatingAt: new Date(), paymentLeaseToken },
    });
    if (lease.count !== 1) {
      const latest = await prisma.order.findUnique({ where: { id: order.id } });
      if (latest?.paymentUrl && latest.status === "PENDING") {
        return { ok: true as const, data: { redirectUrl: latest.paymentUrl, orderId: latest.id } };
      }
      return { ok: false as const, error: t("paymentPreparing") };
    }
    const paymentOrder: OrderForPayment = {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      phone: order.phone,
      currency: order.currency as CurrencyCode,
      shippingFee: order.shippingFee,
      total: order.total,
      locale: parsed.data.locale,
      items: order.items.map((item) => ({
        productId: item.productId,
        title: item.titleEn,
        image: item.image,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    };
    let payment;
    try {
      payment = await getPaymentAdapter(order.paymentMethod as PaymentMethodCode).createPayment(paymentOrder);
    } catch (error) {
      if (!isPaymentCreationUncertainError(error)) {
        const cancelled = await prisma.$transaction(async (transaction) => {
          const transition = await transaction.order.updateMany({
            where: {
              id: order.id,
              status: "PENDING",
              paymentUrl: null,
              paymentLeaseToken,
            },
            data: {
              status: "CANCELLED",
              paymentCreatingAt: null,
              paymentLeaseToken: null,
            },
          });
          if (transition.count !== 1) return false;
          await releaseOrderInventory(transaction, order.id);
          await transaction.cart.updateMany({
            where: { activeCheckoutKey: order.checkoutKey },
            data: { activeCheckoutKey: null },
          });
          return true;
        });
        if (cancelled) {
          const failure = new Error(
            error instanceof Error ? error.message : "Payment creation failed",
          );
          failure.name = "DefinitivePaymentCreationError";
          throw failure;
        }
      }
      throw error;
    }
    const published = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: payment.paidInDevelopment ? { in: ["PENDING", "PAID"] } : "PENDING",
        paymentUrl: null,
        paymentLeaseToken,
      },
      data: {
        paymentUrl: payment.redirectUrl,
        paymentRef: payment.paidInDevelopment ? payment.paymentRef : null,
        providerCheckoutId: payment.checkoutId,
        paymentExpiresAt: payment.expiresAt,
        paymentCreatingAt: null,
        paymentLeaseToken: null,
      },
    });
    if (published.count !== 1) {
      return { ok: false as const, error: t("paymentPreparing") };
    }
    return { ok: true as const, data: { redirectUrl: payment.redirectUrl, orderId: order.id } };
  } catch (error) {
    const safeMessages = new Set([
      "Stripe is not configured",
      "PayPal is not configured",
      "Moyasar is not configured",
    ]);
    return {
      ok: false as const,
      error: error instanceof Error && safeMessages.has(error.message)
        ? t("providerUnavailable")
        : t("placeFailed"),
      ...(error instanceof Error && error.name === "DefinitivePaymentCreationError"
        ? { resetAttempt: true as const }
        : {}),
    };
  }
}
