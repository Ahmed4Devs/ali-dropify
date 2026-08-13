"use client";

import { useState, useTransition } from "react";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateStoreSettingsAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { StoreSettingsData, ValueProposition } from "@/types";

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dollarsToCents(value: string) {
  return Math.round(Number(value) * 100);
}

function SettingsForm({ settings }: { settings: StoreSettingsData }) {
  const t = useTranslations("admin.settings");
  const [storeName, setStoreName] = useState(settings.storeName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [announcementEnabled, setAnnouncementEnabled] = useState(settings.announcementEnabled);
  const [announcementEn, setAnnouncementEn] = useState(settings.announcementEn ?? "");
  const [announcementAr, setAnnouncementAr] = useState(settings.announcementAr ?? "");
  const [heroTitleEn, setHeroTitleEn] = useState(settings.heroTitleEn ?? "");
  const [heroTitleAr, setHeroTitleAr] = useState(settings.heroTitleAr ?? "");
  const [heroSubtitleEn, setHeroSubtitleEn] = useState(settings.heroSubtitleEn ?? "");
  const [heroSubtitleAr, setHeroSubtitleAr] = useState(settings.heroSubtitleAr ?? "");
  const [heroImage, setHeroImage] = useState(settings.heroImage ?? "");
  const [heroCtaEn, setHeroCtaEn] = useState(settings.heroCtaEn ?? "");
  const [heroCtaAr, setHeroCtaAr] = useState(settings.heroCtaAr ?? "");
  const [valueProps, setValueProps] = useState<ValueProposition[]>(settings.valueProps ?? []);
  const [shippingFlat, setShippingFlat] = useState((settings.shippingFlatUsd / 100).toFixed(2));
  const [freeShippingMin, setFreeShippingMin] = useState(settings.freeShippingMinUsd === null ? "" : (settings.freeShippingMinUsd / 100).toFixed(2));
  const [deliveryEstimateEn, setDeliveryEstimateEn] = useState(settings.deliveryEstimateEn ?? "");
  const [deliveryEstimateAr, setDeliveryEstimateAr] = useState(settings.deliveryEstimateAr ?? "");
  const [sarPerUsd, setSarPerUsd] = useState(String(settings.sarPerUsd));
  const [audPerUsd, setAudPerUsd] = useState(String(settings.audPerUsd));
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail ?? "");
  const [supportWhatsapp, setSupportWhatsapp] = useState(settings.supportWhatsapp ?? "");
  const [facebook, setFacebook] = useState(settings.socialLinks?.facebook ?? "");
  const [instagram, setInstagram] = useState(settings.socialLinks?.instagram ?? "");
  const [tiktok, setTiktok] = useState(settings.socialLinks?.tiktok ?? "");
  const [x, setX] = useState(settings.socialLinks?.x ?? "");
  const [isPending, startTransition] = useTransition();

  function updateValueProp(index: number, patch: Partial<ValueProposition>) {
    setValueProps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function submit() {
    startTransition(async () => {
      const result = await updateStoreSettingsAction({
        storeName,
        logoUrl: nullable(logoUrl),
        announcementEnabled,
        announcementEn: nullable(announcementEn),
        announcementAr: nullable(announcementAr),
        heroTitleEn: nullable(heroTitleEn),
        heroTitleAr: nullable(heroTitleAr),
        heroSubtitleEn: nullable(heroSubtitleEn),
        heroSubtitleAr: nullable(heroSubtitleAr),
        heroImage: nullable(heroImage),
        heroCtaEn: nullable(heroCtaEn),
        heroCtaAr: nullable(heroCtaAr),
        valueProps,
        shippingFlatUsd: dollarsToCents(shippingFlat),
        freeShippingMinUsd: freeShippingMin.trim() ? dollarsToCents(freeShippingMin) : null,
        deliveryEstimateEn: nullable(deliveryEstimateEn),
        deliveryEstimateAr: nullable(deliveryEstimateAr),
        sarPerUsd: Number(sarPerUsd),
        audPerUsd: Number(audPerUsd),
        supportEmail: nullable(supportEmail),
        supportWhatsapp: nullable(supportWhatsapp),
        socialLinks: {
          facebook: facebook.trim(),
          instagram: instagram.trim(),
          tiktok: tiktok.trim(),
          x: x.trim(),
        },
      });
      if (!result.ok) {
        toast.error(t("updateError"));
        return;
      }
      toast.success(t("updatedSuccess"));
    });
  }

  return (
    <form action={submit} className="grid gap-5">
      <Card>
        <CardHeader><CardTitle>{t("branding")}</CardTitle><CardDescription>{t("brandingDescription")}</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Label className="grid gap-2">{t("storeName")}<Input value={storeName} onChange={(event) => setStoreName(event.target.value)} required /></Label>
          <Label className="grid gap-2">{t("logoUrl")}<Input type="url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder={t("urlPlaceholder")} /></Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>{t("announcement")}</CardTitle><CardDescription>{t("announcementDescription")}</CardDescription></div>
          <Label className="flex items-center gap-2"><Switch checked={announcementEnabled} onCheckedChange={setAnnouncementEnabled} />{t("announcementEnabled")}</Label>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Label className="grid gap-2">{t("announcementEn")}<Input value={announcementEn} onChange={(event) => setAnnouncementEn(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("announcementAr")}<Input dir="rtl" value={announcementAr} onChange={(event) => setAnnouncementAr(event.target.value)} /></Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("hero")}</CardTitle><CardDescription>{t("heroDescription")}</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Label className="grid gap-2">{t("heroTitleEn")}<Input value={heroTitleEn} onChange={(event) => setHeroTitleEn(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("heroTitleAr")}<Input dir="rtl" value={heroTitleAr} onChange={(event) => setHeroTitleAr(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("heroSubtitleEn")}<Textarea value={heroSubtitleEn} onChange={(event) => setHeroSubtitleEn(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("heroSubtitleAr")}<Textarea dir="rtl" value={heroSubtitleAr} onChange={(event) => setHeroSubtitleAr(event.target.value)} /></Label>
          <Label className="grid gap-2 sm:col-span-2">{t("heroImage")}<Input type="url" value={heroImage} onChange={(event) => setHeroImage(event.target.value)} placeholder={t("urlPlaceholder")} /></Label>
          <Label className="grid gap-2">{t("heroCtaEn")}<Input value={heroCtaEn} onChange={(event) => setHeroCtaEn(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("heroCtaAr")}<Input dir="rtl" value={heroCtaAr} onChange={(event) => setHeroCtaAr(event.target.value)} /></Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>{t("valueProps")}</CardTitle><CardDescription>{t("valuePropsDescription")}</CardDescription></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setValueProps((current) => [...current, { icon: t("defaultValuePropIcon"), titleEn: "", titleAr: "", textEn: "", textAr: "" }])}><PlusIcon />{t("addValueProp")}</Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          {valueProps.map((item, index) => (
            <div key={index} className="rounded-xl border p-4">
              <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-medium">{t("valuePropLabel", { index: index + 1 })}</p><Button type="button" variant="ghost" size="icon-sm" aria-label={t("removeValueProp", { index: index + 1 })} onClick={() => setValueProps((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2Icon /></Button></div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Label className="grid gap-2">{t("icon")}<Input value={item.icon} onChange={(event) => updateValueProp(index, { icon: event.target.value })} /></Label>
                <Label className="grid gap-2">{t("titleEn")}<Input value={item.titleEn} onChange={(event) => updateValueProp(index, { titleEn: event.target.value })} /></Label>
                <Label className="grid gap-2">{t("titleAr")}<Input dir="rtl" value={item.titleAr} onChange={(event) => updateValueProp(index, { titleAr: event.target.value })} /></Label>
                <Label className="grid gap-2 lg:col-span-1">{t("textEn")}<Textarea value={item.textEn} onChange={(event) => updateValueProp(index, { textEn: event.target.value })} /></Label>
                <Label className="grid gap-2 lg:col-span-2">{t("textAr")}<Textarea dir="rtl" value={item.textAr} onChange={(event) => updateValueProp(index, { textAr: event.target.value })} /></Label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("shipping")}</CardTitle><CardDescription>{t("shippingDescription")}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Label className="grid gap-2">{t("flatShipping")}<Input type="number" min="0" step="0.01" value={shippingFlat} onChange={(event) => setShippingFlat(event.target.value)} /></Label>
            <Label className="grid gap-2">{t("freeShippingThreshold")}<Input type="number" min="0" step="0.01" value={freeShippingMin} onChange={(event) => setFreeShippingMin(event.target.value)} placeholder={t("noThreshold")} /></Label>
            <Label className="grid gap-2">{t("deliveryEstimateEn")}<Input value={deliveryEstimateEn} onChange={(event) => setDeliveryEstimateEn(event.target.value)} /></Label>
            <Label className="grid gap-2">{t("deliveryEstimateAr")}<Input dir="rtl" value={deliveryEstimateAr} onChange={(event) => setDeliveryEstimateAr(event.target.value)} /></Label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("currencyRates")}</CardTitle><CardDescription>{t("currencyRatesDescription")}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Label className="grid gap-2">{t("sarPerUsd")}<Input type="number" min="0.000001" step="0.000001" value={sarPerUsd} onChange={(event) => setSarPerUsd(event.target.value)} /></Label>
            <Label className="grid gap-2">{t("audPerUsd")}<Input type="number" min="0.000001" step="0.000001" value={audPerUsd} onChange={(event) => setAudPerUsd(event.target.value)} /></Label>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("supportAndSocial")}</CardTitle><CardDescription>{t("supportDescription")}</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Label className="grid gap-2">{t("supportEmail")}<Input type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("supportWhatsapp")}<Input value={supportWhatsapp} onChange={(event) => setSupportWhatsapp(event.target.value)} /></Label>
          <Separator className="sm:col-span-2" />
          <Label className="grid gap-2">{t("facebookUrl")}<Input type="url" value={facebook} onChange={(event) => setFacebook(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("instagramUrl")}<Input type="url" value={instagram} onChange={(event) => setInstagram(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("tiktokUrl")}<Input type="url" value={tiktok} onChange={(event) => setTiktok(event.target.value)} /></Label>
          <Label className="grid gap-2">{t("xUrl")}<Input type="url" value={x} onChange={(event) => setX(event.target.value)} /></Label>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-30 flex justify-end rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <Button type="submit" size="lg" disabled={isPending}><SaveIcon />{isPending ? t("saving") : t("saveSection")}</Button>
      </div>
    </form>
  );
}

export { SettingsForm };
