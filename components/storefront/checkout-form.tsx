"use client";

import Image from "next/image";
import { CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { placeOrderAction } from "@/actions/checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { convertFromUsd, formatUsdPrice } from "@/lib/currency";
import { useStore } from "@/components/storefront/store-provider";
import type { CheckoutFormProps, PaymentMethodCode, ShippingAddress } from "@/types";
import { track } from "@/lib/analytics";
import { isSupportedShippingCountry, SAUDI_SHIPPING_COUNTRY } from "@/lib/shipping-destination";

const checkoutAttemptSchema = z.object({
  checkoutKey: z.uuid(),
  receiptToken: z.string().regex(/^[a-f0-9]{64}$/),
  cartSignature: z.string().min(1),
});

const blankAddress: ShippingAddress = {
  fullName: "",
  phone: "",
  country: SAUDI_SHIPPING_COUNTRY,
  state: "",
  city: "",
  street: "",
  apartment: "",
  zip: "",
};

export function CheckoutForm({ locale, settings, initialEmail, savedAddresses }: CheckoutFormProps) {
  const t = useTranslations("checkout");
  const common = useTranslations("common");
  const { cart, currency, rates } = useStore();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState(initialEmail);
  const supportedAddresses = savedAddresses.filter((entry) => isSupportedShippingCountry(entry.country));
  const [address, setAddress] = useState<ShippingAddress>(supportedAddresses.find((entry) => entry.isDefault) ?? supportedAddresses[0] ?? blankAddress);
  const availableMethods: PaymentMethodCode[] = currency === "SAR"
    ? ["STRIPE", "MOYASAR"]
    : ["STRIPE", "PAYPAL"];
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodCode>("STRIPE");
  const attemptRef = useRef<{ checkoutKey: string; receiptToken: string; cartSignature: string } | null>(null);
  const threshold = settings.freeShippingMinUsd;
  const shipping = threshold !== null && cart.subtotalUsd >= threshold ? 0 : settings.shippingFlatUsd;
  const total = cart.subtotalUsd + shipping;
  const labels = useMemo(() => ({
    email: common("email"), phone: common("phone"), fullName: t("shippingAddress.fullName"), country: common("country"), state: common("state"), city: common("city"), street: common("street"), apartment: common("apartment"), zip: common("zip"), saved: t("shippingAddress.savedAddress"), subtotal: common("subtotal"), shipping: common("shipping"), total: common("total"), secure: t("secureNotice"), empty: t("emptyCartTitle"),
  }), [common, t]);

  function setField(field: keyof ShippingAddress, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    const cartSignature = JSON.stringify({
      lines: cart.lines
        .map((line) => `${line.id}:${line.quantity}`)
        .sort(),
      currency,
      paymentMethod,
      email: email.trim().toLowerCase(),
      address,
    });
    const storageKey = `store-checkout-attempt:${cart.id}`;
    if (!attemptRef.current) {
      try {
        const stored = sessionStorage.getItem(storageKey);
        const parsedAttempt = stored
          ? checkoutAttemptSchema.safeParse(JSON.parse(stored) as unknown)
          : null;
        if (parsedAttempt?.success) attemptRef.current = parsedAttempt.data;
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }
    if (!attemptRef.current || attemptRef.current.cartSignature !== cartSignature) {
      const receiptBytes = crypto.getRandomValues(new Uint8Array(32));
      attemptRef.current = {
        checkoutKey: crypto.randomUUID(),
        receiptToken: Array.from(receiptBytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
        cartSignature,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(attemptRef.current));
    }
    const attempt = attemptRef.current;
    if (!attempt) return;
    track("begin_checkout", {
      value: convertFromUsd(total, currency, rates) / 100,
      currency,
      num_items: cart.itemCount,
      content_ids: cart.lines.map((line) => line.productId),
    });
    startTransition(async () => {
      const result = await placeOrderAction({
        checkoutKey: attempt.checkoutKey,
        receiptToken: attempt.receiptToken,
        locale,
        currency,
        email,
        phone: address.phone ?? "",
        fullName: address.fullName,
        country: SAUDI_SHIPPING_COUNTRY,
        state: address.state,
        city: address.city,
        street: address.street,
        apartment: address.apartment,
        zip: address.zip,
        paymentMethod: availableMethods.includes(paymentMethod) ? paymentMethod : "STRIPE",
      });
      if (!result.ok) {
        if ("resetAttempt" in result && result.resetAttempt) {
          attemptRef.current = null;
          sessionStorage.removeItem(storageKey);
        }
        toast.error(result.error);
        return;
      }
      window.location.assign(result.data.redirectUrl);
    });
  }

  if (!cart.lines.length) {
    return <div className="rounded-xl border bg-card p-10 text-center"><p className="font-semibold">{labels.empty}</p><p className="mt-2 text-sm text-muted-foreground">{t("emptyCartDescription")}</p></div>;
  }

  return (
    <form className="grid gap-9 lg:grid-cols-[1fr_25rem] lg:gap-14" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="space-y-8">
        <section className="rounded-xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-bold">{t("contact.title")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="checkout-email">{labels.email}</Label><Input id="checkout-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="checkout-phone">{labels.phone}</Label><Input id="checkout-phone" type="tel" autoComplete="tel" required minLength={7} value={address.phone ?? ""} onChange={(event) => setField("phone", event.target.value)} /></div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-bold">{t("shippingAddress.title")}</h2>
          {supportedAddresses.length > 0 && <div className="mt-5 space-y-2"><Label htmlFor="saved-address">{labels.saved}</Label><select id="saved-address" className="h-11 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => { const selected = supportedAddresses.find((entry) => entry.id === event.target.value); if (selected) setAddress({ ...selected, country: SAUDI_SHIPPING_COUNTRY }); }}><option value="">—</option>{supportedAddresses.map((entry) => <option key={entry.id} value={entry.id}>{entry.fullName} · {entry.city}</option>)}</select></div>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="full-name">{labels.fullName}</Label><Input id="full-name" autoComplete="name" required value={address.fullName} onChange={(event) => setField("fullName", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="country">{labels.country}</Label><Input id="country" autoComplete="country-name" required readOnly value={locale === "ar" ? "المملكة العربية السعودية" : SAUDI_SHIPPING_COUNTRY} /><p className="text-xs text-muted-foreground">{t("shippingAddress.saudiOnly")}</p></div>
            <div className="space-y-2"><Label htmlFor="state">{labels.state}</Label><Input id="state" autoComplete="address-level1" required value={address.state} onChange={(event) => setField("state", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="city">{labels.city}</Label><Input id="city" autoComplete="address-level2" required value={address.city} onChange={(event) => setField("city", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="zip">{labels.zip}</Label><Input id="zip" autoComplete="postal-code" required value={address.zip} onChange={(event) => setField("zip", event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="street">{labels.street}</Label><Input id="street" autoComplete="street-address" required value={address.street} onChange={(event) => setField("street", event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="apartment">{labels.apartment}</Label><Input id="apartment" value={address.apartment ?? ""} onChange={(event) => setField("apartment", event.target.value)} /></div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-bold">{t("payment.title")}</h2>
          <RadioGroup value={availableMethods.includes(paymentMethod) ? paymentMethod : "STRIPE"} onValueChange={(value) => setPaymentMethod(value as PaymentMethodCode)} className="mt-5 grid gap-3">
            {availableMethods.map((method) => (
              <label key={method} className={`flex items-center gap-4 rounded-xl border p-4 transition ${paymentMethod === method ? "border-primary bg-accent/60" : "hover:border-foreground/30"}`}>
                <RadioGroupItem value={method} />
                <span className="grid size-10 place-items-center rounded-lg bg-muted"><CreditCard className="size-5" /></span>
                <span className="font-semibold">{t(`payment.${method.toLowerCase()}`)}</span>
              </label>
            ))}
          </RadioGroup>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4 text-primary" />{labels.secure}</div>
        </section>
      </div>

      <aside className="order-first h-fit rounded-xl border bg-card p-5 lg:order-last lg:sticky lg:top-28">
        <h2 className="text-xl font-bold">{t("summary.title")}</h2>
        <div className="mt-5 max-h-80 space-y-4 overflow-y-auto pe-1">
          {cart.lines.map((line) => <div key={line.id} className="flex gap-3"><div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">{line.image && <Image src={line.image} alt={line.title} fill sizes="64px" className="object-cover" />}<span className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-foreground text-[10px] text-background">{line.quantity}</span></div><div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-semibold">{line.title}</p>{line.variantTitle && <p className="text-xs text-muted-foreground">{line.variantTitle}</p>}<p className="mt-1 text-sm">{formatUsdPrice(line.unitPriceUsd * line.quantity, currency, locale, rates)}</p></div></div>)}
        </div>
        <Separator className="my-5" />
        <div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">{labels.subtotal}</span><span>{formatUsdPrice(cart.subtotalUsd, currency, locale, rates)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">{labels.shipping}</span><span>{shipping ? formatUsdPrice(shipping, currency, locale, rates) : common("free")}</span></div></div>
        <Separator className="my-5" />
        <div className="flex justify-between text-lg font-black"><span>{labels.total}</span><span>{formatUsdPrice(total, currency, locale, rates)}</span></div>
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>{pending ? <><LoaderCircle className="size-4 animate-spin" />{t("processing")}</> : <><ShieldCheck className="size-4" />{t("placeOrder")}</>}</Button>
      </aside>
    </form>
  );
}
