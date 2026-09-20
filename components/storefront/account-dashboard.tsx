"use client";

import Image from "next/image";
import { ChevronDown, LogOut, MapPin, Package, Pencil, Plus, Trash2, Upload, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAddressAction, saveAddressAction, updateProfileAction, uploadAvatarAction } from "@/actions/account";
import { signOutAction } from "@/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/currency";
import type { AccountDashboardProps, AddressInput, CurrencyCode, SavedAddressData } from "@/types";

export function AccountDashboard({ locale, user, addresses, orders }: AccountDashboardProps) {
  const router = useRouter();
  const t = useTranslations("account");
  const accountContract = useTranslations("Account");
  const common = useTranslations("common");
  const checkout = useTranslations("checkout");
  const status = useTranslations("status");
  const mutationErrors = useTranslations("mutationErrors");
  const [pending, startTransition] = useTransition();
  const [profile, setProfile] = useState({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", phone: user.phone ?? "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [address, setAddress] = useState<AddressInput>({ locale, fullName: "", phone: "", country: "", state: "", city: "", street: "", apartment: "", zip: "", isDefault: addresses.length === 0 });

  const addressLabels = {
    fullName: checkout("shippingAddress.fullName"),
    phone: common("phone"),
    country: common("country"),
    state: common("state"),
    city: common("city"),
    street: common("street"),
    apartment: common("apartment"),
    zip: common("zip"),
  };
  const orderStatuses = {
    PENDING: status("order.pending"),
    PAID: status("order.paid"),
    FULFILLED: status("order.fulfilled"),
    DELIVERED: status("order.delivered"),
    CANCELLED: status("order.cancelled"),
    REFUNDED: status("order.refunded"),
  };
  const paymentMethods = {
    STRIPE: status("payment.stripe"),
    MOYASAR: status("payment.moyasar"),
    PAYPAL: status("payment.paypal"),
    PADDLE: status("payment.paddle"),
    LEMONSQUEEZY: status("payment.lemonSqueezy"),
  };

  function resetAddress() {
    setAddress({ locale, fullName: "", phone: "", country: "", state: "", city: "", street: "", apartment: "", zip: "", isDefault: addresses.length === 0 });
  }

  function openNewAddress() {
    resetAddress();
    setDialogOpen(true);
  }

  function openAddress(entry: SavedAddressData) {
    setAddress({ ...entry, locale });
    setDialogOpen(true);
  }

  function saveProfile() {
    startTransition(async () => {
      const result = await updateProfileAction({ locale, ...profile });
      if (result.ok) {
        toast.success(t("profile.updated"));
        router.refresh();
      } else toast.error(mutationErrors(result.error));
    });
  }

  function saveAddress() {
    startTransition(async () => {
      const editing = Boolean(address.id);
      const result = await saveAddressAction(address);
      if (result.ok) {
        toast.success(editing ? t("addresses.updated") : t("addresses.created"));
        setDialogOpen(false);
        router.refresh();
      } else toast.error(mutationErrors(result.error));
    });
  }

  function removeAddress(id: string) {
    if (!window.confirm(t("addresses.deleteDescription"))) return;
    startTransition(async () => {
      const result = await deleteAddressAction({ id, locale });
      if (result.ok) {
        toast.success(t("addresses.deleted"));
        router.refresh();
      } else toast.error(mutationErrors(result.error));
    });
  }

  function uploadAvatar(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.set("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatarAction(locale, body);
      if (result.ok) router.refresh();
      else toast.error(mutationErrors(result.error));
    });
  }

  function logout() {
    startTransition(async () => {
      const result = await signOutAction();
      if (!result.ok) {
        toast.error(mutationErrors(result.error));
        return;
      }
      router.push(`/${locale}`);
      router.refresh();
    });
  }

  return (
    <div className="container-shell py-10 sm:py-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="size-16">
              <AvatarImage src={user.image ?? undefined} alt="" />
              <AvatarFallback className="text-xl font-bold">{(user.firstName || user.email).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -end-1 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow" aria-label={t("profile.changeAvatar")}>
              <Upload className="size-3.5" />
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => uploadAvatar(event.target.files?.[0])} />
            </label>
          </div>
          <div><h1 className="text-2xl font-bold">{user.firstName ? `${user.firstName} ${user.lastName ?? ""}` : user.email}</h1><p className="text-sm text-muted-foreground">{user.email}</p></div>
        </div>
        <Button variant="outline" onClick={logout} disabled={pending}><LogOut className="size-4" />{accountContract("signOut")}</Button>
      </div>

      <Tabs defaultValue="profile" className="mt-10">
        <TabsList className="grid w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="profile"><UserRound className="size-4" />{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="addresses"><MapPin className="size-4" />{t("tabs.addresses")}</TabsTrigger>
          <TabsTrigger value="orders"><Package className="size-4" />{t("tabs.orders")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 max-w-2xl rounded-xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-bold">{t("profile.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
          <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); saveProfile(); }}>
            <div className="space-y-2"><Label htmlFor="profile-first-name">{common("firstName")}</Label><Input id="profile-first-name" required minLength={2} value={profile.firstName} onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="profile-last-name">{common("lastName")}</Label><Input id="profile-last-name" required minLength={2} value={profile.lastName} onChange={(event) => setProfile((current) => ({ ...current, lastName: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-email">{common("email")}</Label><Input id="profile-email" disabled value={user.email} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-phone">{common("phone")}</Label><Input id="profile-phone" type="tel" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></div>
            <Button type="submit" className="mt-2 w-fit" disabled={pending}>{t("profile.save")}</Button>
          </form>
        </TabsContent>

        <TabsContent value="addresses" className="mt-6">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="text-xl font-bold">{t("addresses.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("addresses.subtitle")}</p></div>
            <Button onClick={openNewAddress}><Plus className="size-4" />{t("addresses.add")}</Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{address.id ? t("addresses.edit") : t("addresses.add")}</DialogTitle></DialogHeader>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); saveAddress(); }}>
                {(["fullName", "phone", "country", "state", "city", "street", "apartment", "zip"] as const).map((field) => (
                  <div key={field} className={`space-y-1.5 ${field === "street" || field === "apartment" ? "sm:col-span-2" : ""}`}>
                    <Label htmlFor={`address-${field}`}>{addressLabels[field]}</Label>
                    <Input id={`address-${field}`} required={field !== "phone" && field !== "apartment"} value={address[field] ?? ""} onChange={(event) => setAddress((current) => ({ ...current, [field]: event.target.value }))} />
                  </div>
                ))}
                <label className="mt-2 flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={address.isDefault} onChange={(event) => setAddress((current) => ({ ...current, isDefault: event.target.checked }))} />{t("addresses.setDefault")}</label>
                <Button type="submit" className="sm:col-span-2" disabled={pending}>{common("save")}</Button>
              </form>
            </DialogContent>
          </Dialog>
          {addresses.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {addresses.map((entry) => (
                <article key={entry.id} className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-bold">{entry.fullName}</p>{entry.isDefault && <Badge className="mt-2">{t("addresses.default")}</Badge>}</div>
                    <div className="flex gap-1">
                      <button onClick={() => openAddress(entry)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("addresses.edit")}><Pencil className="size-4" /></button>
                      <button onClick={() => removeAddress(entry.id)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={t("addresses.delete")}><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{entry.street}{entry.apartment ? `, ${entry.apartment}` : ""}<br />{entry.city}, {entry.state} {entry.zip}<br />{entry.country}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground"><MapPin className="mx-auto size-8" /><p className="mt-3">{t("addresses.emptyDescription")}</p></div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <h2 className="mb-5 text-xl font-bold">{t("orders.title")}</h2>
          {orders.length ? (
            <div className="space-y-3">
              {orders.map((order) => (
                <details key={order.id} className="group rounded-xl border bg-card">
                  <summary className="flex list-none items-center gap-4 p-4 sm:p-5">
                    <div className="min-w-0 flex-1"><p className="font-bold">{t("orders.order", { number: order.orderNumber })}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(order.createdAt))}</p></div>
                    <Badge variant="secondary">{orderStatuses[order.status]}</Badge>
                    <p className="font-bold">{formatMoney(order.total, order.currency as CurrencyCode, locale)}</p>
                    <ChevronDown className="size-4 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t p-4 sm:p-5">
                    {order.items.map((item) => <div key={item.id} className="flex items-center gap-3 py-2">{item.image && <div className="relative size-12 overflow-hidden rounded-lg"><Image src={item.image} alt="" fill sizes="48px" className="object-cover" /></div>}<p className="flex-1 text-sm font-semibold">{locale === "ar" ? item.titleAr ?? item.titleEn : item.titleEn} × {item.quantity}</p><p className="text-sm">{formatMoney(item.unitPrice * item.quantity, order.currency as CurrencyCode, locale)}</p></div>)}
                    <div className="mt-4 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
                      <div><p className="font-semibold">{t("orders.paymentMethod")}</p><p className="mt-1 text-muted-foreground">{order.paymentMethod ? paymentMethods[order.paymentMethod] : common("none")}</p></div>
                      <div><p className="font-semibold">{t("orders.shippingAddress")}</p><p className="mt-1 leading-6 text-muted-foreground">{order.shippingAddress.fullName}<br />{order.shippingAddress.street}{order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}<br />{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}<br />{order.shippingAddress.country}</p></div>
                    </div>
                    {order.status === "PENDING" && order.paymentUrl && (
                      <Button asChild className="mt-4">
                        <a href={order.paymentUrl}>{t("orders.resumePayment")}</a>
                      </Button>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground"><Package className="mx-auto size-8" /><p className="mt-3">{t("orders.emptyDescription")}</p></div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
