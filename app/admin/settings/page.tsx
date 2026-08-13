import { createTranslator } from "next-intl";

import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/dal";
import { getStoreSettings } from "@/lib/data";
import messages from "@/messages/en.json";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getStoreSettings();
  const t = createTranslator({ locale: "en", messages, namespace: "admin.settings" });
  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("subtitle")}
      />
      <SettingsForm settings={settings} />
    </>
  );
}
