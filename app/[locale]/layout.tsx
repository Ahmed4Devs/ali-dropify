import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsProvider } from "@/components/shared/analytics";
import { routing } from "@/i18n/routing";
import { getStoreSettings } from "@/lib/data";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const settings = await getStoreSettings().catch(() => null);
  const storeName = settings?.storeName ?? "Online Store";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
  const image = `${origin}/og.png`;
  return {
    title: { default: storeName, template: `%s · ${storeName}` },
    description: settings?.heroSubtitleEn ?? "Thoughtful essentials, honest prices, secure checkout, and tracked delivery.",
    metadataBase: new URL(origin),
    openGraph: {
      title: storeName,
      description: settings?.heroSubtitleEn ?? "Thoughtful essentials at honest prices.",
      type: "website",
      images: [{ url: image, width: 1731, height: 909, alt: storeName }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleRootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${inter.variable} ${cairo.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-svh bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          {children}
          <AnalyticsProvider />
          <Toaster richColors position={locale === "ar" ? "top-left" : "top-right"} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
