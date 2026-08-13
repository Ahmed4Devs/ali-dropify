import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/storefront/auth-forms";
import type { Locale } from "@/types";

export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const t = await getTranslations({ locale, namespace: "auth.signIn" });
  return <div className="container-shell flex min-h-[65vh] items-center justify-center py-12"><div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><div className="mb-7 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary"><ShieldCheck className="size-5" /></span><h1 className="mt-4 text-2xl font-bold">{t("title")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p></div><SignInForm locale={locale} /></div></div>;
}
