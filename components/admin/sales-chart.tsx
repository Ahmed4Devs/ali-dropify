"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormatter, useTranslations } from "next-intl";

function SalesChart({
  data,
}: {
  data: { label: string; revenue: number; orders: number }[];
}) {
  const format = useFormatter();
  const t = useTranslations("admin.dashboard");
  const formatRevenue = (value: number) => format.number(value, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {t("noPaidOrders")}
      </div>
    );
  }

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(value: number) => formatRevenue(value)}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            formatter={(value) => [formatRevenue(Number(value)), t("revenueSeries")]}
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              boxShadow: "0 8px 24px rgb(0 0 0 / 0.08)",
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="var(--primary)"
            fillOpacity={0.1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export { SalesChart };
