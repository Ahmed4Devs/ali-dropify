import { CheckoutForm } from "@/components/storefront/checkout-form";
import { CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/dal";
import { getAddressesForUser, getStoreSettings } from "@/lib/data";
import type { Locale, SavedAddressData } from "@/types";

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[locale]/checkout">) {
  const { locale: localeParam } = await params;
  const { payment } = await searchParams;
  const locale = localeParam as Locale;
  const t = await getTranslations({ locale, namespace: "checkout" });
  const session = await getSession();
  const [settings, addresses] = await Promise.all([
    getStoreSettings(),
    session ? getAddressesForUser(session.user.id) : Promise.resolve([]),
  ]);
  return (
    <div className="container-shell py-10 sm:py-14">
      <div className="mb-8 flex items-center justify-between gap-4"><h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1><p className="text-xs font-semibold text-muted-foreground">{t("subtitle")}</p></div>
      {(payment === "cancelled" || payment === "failed") && (
        <div role="status" className="mb-6 flex flex-col gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-semibold">{t(payment === "cancelled" ? "paymentCancelledTitle" : "paymentFailedTitle")}</p>
              <p className="mt-1 text-muted-foreground">{t(payment === "cancelled" ? "paymentCancelledDescription" : "paymentFailedDescription")}</p>
            </div>
          </div>
          <a href="#checkout-retry" className="shrink-0 font-semibold text-primary underline-offset-4 hover:underline">
            {t("retryPayment")}
          </a>
        </div>
      )}
      <div id="checkout-retry">
        <CheckoutForm locale={locale} settings={settings} initialEmail={session?.user.email ?? ""} savedAddresses={addresses as SavedAddressData[]} />
      </div>
    </div>
  );
}
