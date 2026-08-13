"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function DashboardRangeSelect({ range }: { range: 7 | 30 | 90 }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("admin.dashboard");

  return (
    <Select
      value={String(range)}
      onValueChange={(value) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("range", value);
        router.replace(`/admin?${next.toString()}`);
      }}
    >
      <SelectTrigger className="w-full bg-background sm:w-44" aria-label={t("rangeLabel")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">{t("range7")}</SelectItem>
        <SelectItem value="30">{t("range30")}</SelectItem>
        <SelectItem value="90">{t("range90")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

export { DashboardRangeSelect };
