"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { ExternalLinkIcon, PackageOpenIcon, SearchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateOrderStatusAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const orderStatuses = [
  "PENDING",
  "PAID",
  "FULFILLED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

function statusVariant(status: string) {
  if (status === "DELIVERED" || status === "FULFILLED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "CANCELLED" || status === "REFUNDED") return "destructive" as const;
  return "secondary" as const;
}

function money(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function isOrderStatus(value: string): value is (typeof orderStatuses)[number] {
  return orderStatuses.some((status) => status === value);
}

function canTransition(from: string, to: string) {
  if (from === to) return true;
  const transitions: Record<string, readonly string[]> = {
    PENDING: ["PAID", "CANCELLED"],
    PAID: ["FULFILLED", "CANCELLED", "REFUNDED"],
    FULFILLED: ["DELIVERED", "CANCELLED", "REFUNDED"],
    DELIVERED: ["REFUNDED"],
    CANCELLED: [],
    REFUNDED: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

function OrderManager({
  orders,
}: {
  orders: {
    id: string;
    orderNumber: string;
    email: string;
    phone: string | null;
    status: string;
    currency: string;
    total: number;
    profit: number;
    paymentMethod: string | null;
    paymentRef: string | null;
    createdAt: string;
    shippingAddress: {
      fullName: string;
      phone?: string;
      country: string;
      state: string;
      city: string;
      street: string;
      apartment?: string;
      zip: string;
    };
    items: {
      id: string;
      title: string;
      image: string | null;
      quantity: number;
      unitPrice: number;
      aliexpressUrl: string | null;
    }[];
  }[];
}) {
  const t = useTranslations("admin.orders");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const [selected, setSelected] = useState<(typeof orders)[number] | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function orderStatusLabel(status: string) {
    if (status === "PENDING") return statusT("order.pending");
    if (status === "PAID") return statusT("order.paid");
    if (status === "FULFILLED") return statusT("order.fulfilled");
    if (status === "DELIVERED") return statusT("order.delivered");
    if (status === "CANCELLED") return statusT("order.cancelled");
    if (status === "REFUNDED") return statusT("order.refunded");
    return status;
  }

  function paymentMethodLabel(method: string | null) {
    if (method === "STRIPE") return statusT("payment.stripe");
    if (method === "MOYASAR") return statusT("payment.moyasar");
    if (method === "PAYPAL") return statusT("payment.paypal");
    return common("notAvailable");
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const created = new Date(order.createdAt).getTime();
      const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
      return (
        (statusFilter === "ALL" || order.status === statusFilter) &&
        (!normalized ||
          `${order.orderNumber} ${order.email} ${order.shippingAddress.fullName}`
            .toLowerCase()
            .includes(normalized)) &&
        (from === null || created >= from) &&
        (to === null || created <= to)
      );
    });
  }, [fromDate, orders, query, statusFilter, toDate]);

  async function copyShippingInfo() {
    if (!selected) return;
    const address = selected.shippingAddress;
    const content = [
      address.fullName,
      address.phone || selected.phone,
      address.street,
      address.apartment,
      `${address.city}, ${address.state} ${address.zip}`,
      address.country,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(content);
      toast.success(t("shippingCopied"));
    } catch {
      toast.error(t("shippingCopyFailed"));
    }
  }

  function updateStatus(status: string) {
    if (!selected || !isOrderStatus(status)) return;
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId: selected.id, status });
      if (!result.ok) {
        toast.error(t("statusUpdateFailed"));
        return;
      }
      setSelected({ ...selected, status });
      toast.success(t("statusUpdated"));
    });
  }

  return (
    <>
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_10rem_10rem]">
        <Label className="relative block">
          <span className="sr-only">{t("searchLabel")}</span>
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full" aria-label={t("filterStatus")}><SelectValue placeholder={t("allStatuses")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("allStatuses")}</SelectItem>
            {orderStatuses.map((status) => <SelectItem key={status} value={status}>{orderStatusLabel(status)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label className="grid gap-1.5 text-xs text-muted-foreground">
          {t("fromDate")}
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </Label>
        <Label className="grid gap-1.5 text-xs text-muted-foreground">
          {t("toDate")}
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </Label>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("number")}</TableHead>
              <TableHead>{t("customer")}</TableHead>
              <TableHead>{t("itemCount")}</TableHead>
              <TableHead>{common("total")}</TableHead>
              <TableHead>{t("profit")}</TableHead>
              <TableHead>{t("paymentMethod")}</TableHead>
              <TableHead>{common("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => setSelected(order)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(order);
                  }
                }}
              >
                <TableCell>
                  <p className="font-medium">#{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(order.createdAt))}</p>
                </TableCell>
                <TableCell>
                  <p className="max-w-48 truncate font-medium">{order.shippingAddress.fullName}</p>
                  <p className="max-w-48 truncate text-xs text-muted-foreground">{order.email}</p>
                </TableCell>
                <TableCell>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                <TableCell className="font-medium">{money(order.total, order.currency, locale)}</TableCell>
                <TableCell>{money(order.profit, order.currency, locale)}</TableCell>
                <TableCell>{paymentMethodLabel(order.paymentMethod)}</TableCell>
                <TableCell><Badge variant={statusVariant(order.status)}>{orderStatusLabel(order.status)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!filtered.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <PackageOpenIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
          </div>
        ) : null}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>{t("detailsTitle", { number: selected.orderNumber })}</SheetTitle>
                <SheetDescription>{selected.email} · {money(selected.total, selected.currency, locale)}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 p-4">
                <section className="grid gap-3">
                  <h2 className="text-sm font-semibold">{common("items")}</h2>
                  {selected.items.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-xl border p-3">
                      <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs text-muted-foreground">
                        {item.image ? <Image src={item.image} alt="" fill sizes="56px" className="object-cover" /> : t("noImage")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.quantity} × {money(item.unitPrice, selected.currency, locale)}</p>
                        {item.aliexpressUrl ? (
                          <Button asChild variant="link" size="sm" className="h-auto px-0">
                            <a href={item.aliexpressUrl} target="_blank" rel="noreferrer">{t("openSupplier")} <ExternalLinkIcon /></a>
                          </Button>
                        ) : <p className="mt-1 text-xs text-muted-foreground">{t("sourceUnavailable")}</p>}
                      </div>
                    </div>
                  ))}
                </section>

                <section className="grid gap-2 rounded-xl border p-4">
                  <h2 className="text-sm font-semibold">{t("shippingAddress")}</h2>
                  <address className="text-sm not-italic leading-6 text-muted-foreground">
                    {selected.shippingAddress.fullName}<br />
                    {selected.shippingAddress.phone || selected.phone}<br />
                    {selected.shippingAddress.street}{selected.shippingAddress.apartment ? `, ${selected.shippingAddress.apartment}` : ""}<br />
                    {selected.shippingAddress.city}, {selected.shippingAddress.state} {selected.shippingAddress.zip}<br />
                    {selected.shippingAddress.country}
                  </address>
                  <Button type="button" variant="outline" onClick={copyShippingInfo}>{t("copyShipping")}</Button>
                </section>

                <section className="grid gap-3 rounded-xl border p-4">
                  <div>
                    <h2 className="text-sm font-semibold">{t("paymentStatus")}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{t("paymentReference")}: {selected.paymentRef ?? common("notAvailable")}</p>
                  </div>
                  <Select value={selected.status} onValueChange={updateStatus} disabled={isPending}>
                    <SelectTrigger className="w-full" aria-label={t("updateStatus")}><SelectValue /></SelectTrigger>
                    <SelectContent>{orderStatuses.map((status) => <SelectItem key={status} value={status} disabled={!canTransition(selected.status, status)}>{orderStatusLabel(status)}</SelectItem>)}</SelectContent>
                  </Select>
                </section>
              </div>
              <SheetFooter className="border-t">
                <Button variant="outline" onClick={() => setSelected(null)}>{common("close")}</Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

export { OrderManager };
