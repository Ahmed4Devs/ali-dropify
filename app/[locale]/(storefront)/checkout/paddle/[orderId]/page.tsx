import { getTranslations } from "next-intl/server";

import { PaddleCheckout } from "@/components/storefront/paddle-checkout";
import type { Locale } from "@/types";

export default async function PaddleCheckoutPage({
  params,
}: PageProps<"/[locale]/checkout/paddle/[orderId]">) {
  const { locale: localeParam, orderId } = await params;
  const locale = localeParam as Locale;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return (
    <PaddleCheckout
      clientToken={process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? ""}
      environment={process.env.PADDLE_ENV === "live" ? "live" : "sandbox"}
      locale={locale}
      orderId={orderId}
      loadingLabel={t("paddleLoading")}
      errorLabel={t("paddleUnavailable")}
    />
  );
}
