import Image from "next/image";
import { CheckCircle2, Clock3, Mail, PackageCheck, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PurchaseTracker } from "@/components/storefront/purchase-tracker";
import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/dal";
import { cookies } from "next/headers";
import { orderReceiptCookieName, receiptMatches } from "@/lib/order-receipt";
import type { CurrencyCode, Locale } from "@/types";

export default async function SuccessPage({ params, searchParams }: PageProps<"/[locale]/checkout/success">) {
  const [{ locale: localeParam }, query] = await Promise.all([params, searchParams]);
  const locale = localeParam as Locale;
  const orderId = typeof query.order === "string" ? query.order : "";
  let order = null;
  try { order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } }); } catch { order = null; }
  if (!order) notFound();
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  const receipt = cookieStore.get(orderReceiptCookieName(order.id))?.value;
  const canRead = order.userId
    ? order.userId === session?.user.id
    : receiptMatches(receipt, order.receiptTokenHash);
  if (!canRead) notFound();
  const currency = order.currency as CurrencyCode;
  const isArabic = locale === "ar";
  const paid = order.status === "PAID" || order.status === "FULFILLED" || order.status === "DELIVERED";
  const [t, common] = await Promise.all([
    getTranslations({ locale, namespace: "success" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  if (!paid) {
    return (
      <div className="container-shell flex min-h-[60vh] max-w-2xl flex-col items-center justify-center py-16 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-secondary text-primary">
          <Clock3 className="size-10" />
        </span>
        <p className="mt-6 text-sm font-bold uppercase tracking-[.16em] text-primary">
          {t("orderNumber", { number: order.orderNumber })}
        </p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">
          {t("processingTitle")}
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
          {t("processingDescription")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {order.paymentUrl && <Button asChild><a href={order.paymentUrl}>{t("resumePayment")}</a></Button>}
          <Button asChild variant={order.paymentUrl ? "outline" : "default"}><a href={`/${locale}/checkout/success?order=${order.id}`}>{common("retry")}</a></Button>
          {session && <Button asChild variant="outline"><Link href="/account">{t("trackInAccount")}</Link></Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="container-shell max-w-3xl py-12 sm:py-20">
      <PurchaseTracker orderId={order.orderNumber} contentIds={order.items.flatMap((item) => item.productId ? [item.productId] : [])} value={order.total / 100} currency={currency} />
      <div className="text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-accent text-primary"><CheckCircle2 className="size-10" /></span><p className="mt-6 text-sm font-bold uppercase tracking-[.16em] text-primary">{t("orderNumber", { number: order.orderNumber })}</p><h1 className="mt-3 text-balance text-3xl font-black sm:text-5xl">{t("title")}</h1><p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">{t("confirmationSent", { email: order.email })}</p></div>
      <div className="mt-10 rounded-xl border bg-card p-5 sm:p-7"><div className="space-y-4">{order.items.map((item) => <div key={item.id}><div className="flex items-center gap-4"><div className="relative size-16 overflow-hidden rounded-lg bg-muted">{item.image && <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{isArabic ? item.titleAr ?? item.titleEn : item.titleEn}</p><p className="text-sm text-muted-foreground">× {item.quantity}</p></div><p className="font-bold">{formatMoney(item.unitPrice * item.quantity, currency, locale)}</p></div>{item.trackingNumber && <p className="mt-2 text-sm text-muted-foreground">{t("tracking")}: {item.carrier ? `${item.carrier} · ` : ""}{item.trackingUrl ? <a href={item.trackingUrl} target="_blank" rel="noreferrer" className="text-primary underline">{item.trackingNumber}</a> : item.trackingNumber}</p>}</div>)}</div><div className="mt-6 flex justify-between border-t pt-5 text-lg font-black"><span>{common("total")}</span><span>{formatMoney(order.total, currency, locale)}</span></div></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">{[{ icon: Mail, label: t("paidTitle") }, { icon: PackageCheck, label: t("whatNextTitle") }, { icon: Truck, label: t("trackInAccount") }].map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-3 rounded-xl bg-secondary p-4 text-sm font-semibold"><Icon className="size-5 text-primary" />{label}</div>)}</div>
      <div className="mt-10 text-center"><Button asChild size="lg"><Link href="/products">{t("continueShopping")}</Link></Button></div>
    </div>
  );
}
