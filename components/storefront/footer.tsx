import Image from "next/image";
import { Camera, MessageCircle, Music2, ShieldCheck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale, StoreSettingsData } from "@/types";

export async function StoreFooter({ locale, settings }: { locale: Locale; settings: StoreSettingsData }) {
  const t = await getTranslations({ locale, namespace: "Common" });
  const hasSocialLinks = Boolean(
    settings.socialLinks?.facebook ||
    settings.socialLinks?.instagram ||
    settings.socialLinks?.tiktok ||
    settings.socialLinks?.x ||
    settings.supportWhatsapp,
  );
  return (
    <footer className="mt-20 border-t bg-card">
      <div className="container-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:py-16">
        <div>
          <Link href="/" className="flex items-center gap-2 text-2xl font-black">
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} alt="" width={36} height={36} className="size-9 rounded-xl object-cover" />
            ) : (
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm text-primary-foreground">
                {settings.storeName.charAt(0).toUpperCase()}
              </span>
            )}
            {settings.storeName}
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            {locale === "ar" ? settings.heroSubtitleAr : settings.heroSubtitleEn}
          </p>
          {hasSocialLinks && (
            <nav aria-label={t("socialLinks")} className="mt-5 flex flex-wrap gap-2">
              {settings.socialLinks?.facebook && <a href={settings.socialLinks.facebook} target="_blank" rel="noreferrer" aria-label={t("socialFacebook")} className="grid size-9 place-items-center rounded-full border hover:bg-muted"><Users aria-hidden="true" className="size-4" /></a>}
              {settings.socialLinks?.instagram && <a href={settings.socialLinks.instagram} target="_blank" rel="noreferrer" aria-label={t("socialInstagram")} className="grid size-9 place-items-center rounded-full border hover:bg-muted"><Camera aria-hidden="true" className="size-4" /></a>}
              {settings.socialLinks?.tiktok && <a href={settings.socialLinks.tiktok} target="_blank" rel="noreferrer" aria-label={t("socialTiktok")} className="grid size-9 place-items-center rounded-full border hover:bg-muted"><Music2 aria-hidden="true" className="size-4" /></a>}
              {settings.socialLinks?.x && <a href={settings.socialLinks.x} target="_blank" rel="noreferrer" aria-label={t("socialX")} className="grid size-9 place-items-center rounded-full border text-sm font-black hover:bg-muted"><span aria-hidden="true">X</span></a>}
              {settings.supportWhatsapp && <a href={`https://wa.me/${settings.supportWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label={t("socialWhatsapp")} className="grid size-9 place-items-center rounded-full border hover:bg-muted"><MessageCircle aria-hidden="true" className="size-4" /></a>}
            </nav>
          )}
        </div>
        <div>
          <p className="mb-4 font-bold">{t("quickLinks")}</p>
          <nav className="flex flex-col gap-3 text-sm text-muted-foreground">
            <Link href="/products" className="hover:text-primary">{t("shop")}</Link>
            <Link href="/cart" className="hover:text-primary">{t("cart")}</Link>
            <Link href="/account" className="hover:text-primary">{t("account")}</Link>
          </nav>
        </div>
        <div>
          <p className="mb-4 font-bold">{t("support")}</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{settings.supportEmail}</p><p dir="ltr" className="text-start">{settings.supportWhatsapp}</p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" /> {t("paymentTrust")}
          </div>
        </div>
      </div>
      <div className="border-t py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings.storeName}. {t("rightsReserved")}
      </div>
    </footer>
  );
}
