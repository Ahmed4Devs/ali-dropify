import Link from "next/link";
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  ChartNoAxesCombinedIcon,
  EyeIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import { DashboardRangeSelect } from "@/components/admin/range-select";
import { SalesChart } from "@/components/admin/sales-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProgressList } from "@/components/admin/progress-list";
import { requireAdmin } from "@/lib/dal";
import { getAdminSnapshot } from "@/lib/data";

function dateValue(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function moneyInCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  await requireAdmin();
  const query = await searchParams;
  const requested = Array.isArray(query.range) ? query.range[0] : query.range;
  const range = requested === "7" ? 7 : requested === "90" ? 90 : 30;
  const [snapshot, t] = await Promise.all([
    getAdminSnapshot(range),
    getTranslations({ locale: "en", namespace: "admin.dashboard" }),
  ]);
  const orders = snapshot.orders;
  const products = snapshot.products;
  const revenue = orders.reduce(
    (sum, order) => sum + Math.round(order.total / Number(order.fxRate)),
    0,
  );
  const profit = orders.reduce(
    (sum, order) =>
      sum +
      Math.round(order.items.reduce(
        (itemSum, item) => itemSum +
          (item.unitPrice - item.unitCostUsd * Number(order.fxRate)) * item.quantity,
        0,
      ) / Number(order.fxRate)),
    0,
  );
  const averageOrderValue = orders.length ? Math.round(revenue / orders.length) : 0;
  const grouped = new Map<string, { label: string; revenue: number; orders: number }>();
  for (const order of [...orders].reverse()) {
    const date = dateValue(order.createdAt);
    const key = date.toISOString().slice(0, 10);
    const current = grouped.get(key) ?? {
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date),
      revenue: 0,
      orders: 0,
    };
    current.revenue += order.total / Number(order.fxRate) / 100;
    current.orders += 1;
    grouped.set(key, current);
  }
  const revenueByProduct = new Map<string, { label: string; value: number; units: number }>();
  for (const order of orders) {
    const fxRate = Number(order.fxRate);
    for (const item of order.items) {
      const key = item.productId ?? item.id;
      const current = revenueByProduct.get(key) ?? { label: item.titleEn, value: 0, units: 0 };
      current.value += Math.round((item.unitPrice * item.quantity) / fxRate);
      current.units += item.quantity;
      revenueByProduct.set(key, current);
    }
  }
  const topRevenue = [...revenueByProduct.values()]
    .map((entry) => ({
      label: entry.label,
      value: entry.value,
      detail: t("unitsSold", { count: entry.units }),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const mostViewed = snapshot.views
    .map((view) => ({
      product: products.find((product) => product.id === view.productId),
      count: view._sum.count ?? 0,
    }))
    .filter((entry) => entry.product)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((entry) => ({
      label: entry.product?.titleEn ?? t("unknownProduct"),
      value: entry.count,
      detail: t("views", { count: entry.count }),
    }));
  const outOfStock = products.filter((product) => !product.inStock);

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("subtitle")}
        action={<DashboardRangeSelect range={range} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("revenue"), value: money(revenue), hint: t("paidOrders", { count: orders.length }), icon: BanknoteIcon },
          { label: t("orders"), value: orders.length.toLocaleString(), hint: t(`range${range}`), icon: ReceiptTextIcon },
          { label: t("profit"), value: money(profit), hint: revenue ? t("margin", { percent: Math.round((profit / revenue) * 100) }) : t("noSalesYet"), icon: ChartNoAxesCombinedIcon },
          { label: t("averageOrderValue"), value: money(averageOrderValue), hint: t("paidOrderValue"), icon: PackageCheckIcon },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="gap-3 py-5">
              <CardContent className="px-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
                </div>
                <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("salesOverTime")}</CardTitle>
            <CardDescription>{t("recognizedRevenueDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart data={[...grouped.values()]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("recentOrders")}</CardTitle>
            <CardDescription>{t("latestActivityDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            {orders.slice(0, 6).map((order) => (
              <Link key={order.id} href="/admin/orders" className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">#{order.orderNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">{order.email}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-medium">{moneyInCurrency(order.total, order.currency)}</p>
                  <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dateValue(order.createdAt))}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><PackageCheckIcon className="size-4" /></span>
            <div><CardTitle>{t("bestSellers")}</CardTitle><CardDescription>{t("itemRevenueDescription")}</CardDescription></div>
          </CardHeader>
          <CardContent><ProgressList items={topRevenue} formatValue={money} emptyMessage={t("noData")} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><EyeIcon className="size-4" /></span>
            <div><CardTitle>{t("mostViewed")}</CardTitle><CardDescription>{t("mostViewedDescription")}</CardDescription></div>
          </CardHeader>
          <CardContent><ProgressList items={mostViewed} formatValue={(value) => value.toLocaleString()} emptyMessage={t("noData")} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><SearchIcon className="size-4" /></span>
            <div><CardTitle>{t("topSearches")}</CardTitle><CardDescription>{t("topSearchesDescription")}</CardDescription></div>
          </CardHeader>
          <CardContent>
            <ProgressList items={snapshot.searches.map((search) => ({ label: search.term, value: search.count, detail: t("searches", { count: search.count }) }))} formatValue={(value) => value.toLocaleString()} emptyMessage={t("noData")} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><TriangleAlertIcon className="size-4 text-amber-600" />{t("outOfStock")}</CardTitle>
            <CardDescription>{t("inventoryDescription")}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link href="/admin/products">{t("manageCatalog")} <ArrowUpRightIcon /></Link></Button>
        </CardHeader>
        <CardContent>
          {outOfStock.length ? (
            <div className="flex flex-wrap gap-2">{outOfStock.map((product) => <Badge key={product.id} variant="warning">{product.titleEn}</Badge>)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noStockAlerts")}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
