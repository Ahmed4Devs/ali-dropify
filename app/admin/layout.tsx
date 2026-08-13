import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { Toaster } from "@/components/ui/sonner";
import { requireAdmin } from "@/lib/dal";
import { getStoreSettings } from "@/lib/data";
import messages from "@/messages/en.json";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin.metadata" });
  return {
    title: {
      default: t("title"),
      template: `%s · ${t("title")}`,
    },
    description: t("description"),
  };
}

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  const settings = await getStoreSettings();
  const adminName = session.user.name?.trim() || session.user.email.split("@")[0];

  return (
    <html lang="en" dir="ltr" className={`${inter.variable} antialiased`}>
      <body className="min-h-svh bg-background text-foreground">
        <NextIntlClientProvider locale="en" messages={messages}>
          <AdminShell
            storeName={settings.storeName}
            adminName={adminName}
            adminEmail={session.user.email}
          >
            {children}
          </AdminShell>
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
