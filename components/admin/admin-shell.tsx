"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BoxesIcon,
  ExternalLinkIcon,
  GaugeIcon,
  MenuIcon,
  MessageSquareTextIcon,
  PackageCheckIcon,
  Settings2Icon,
  StoreIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("admin.shell");
  const items = [
    { href: "/admin", label: t("dashboard"), icon: GaugeIcon },
    { href: "/admin/products", label: t("products"), icon: BoxesIcon },
    { href: "/admin/orders", label: t("orders"), icon: PackageCheckIcon },
    { href: "/admin/reviews", label: t("reviews"), icon: MessageSquareTextIcon },
    { href: "/admin/settings", label: t("settings"), icon: Settings2Icon },
  ];

  return (
    <nav aria-label={t("navigationLabel")} className="grid gap-1">
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdminBrand({ storeName }: { storeName: string }) {
  const t = useTranslations("admin.shell");

  return (
    <Link href="/admin" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <StoreIcon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{storeName}</span>
        <span className="block text-xs text-muted-foreground">{t("brandSubtitle")}</span>
      </span>
    </Link>
  );
}

function AdminShell({
  children,
  storeName,
  adminName,
  adminEmail,
}: {
  children: ReactNode;
  storeName: string;
  adminName: string;
  adminEmail: string;
}) {
  const t = useTranslations("admin.shell");

  return (
    <div className="min-h-svh bg-muted/35 md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh border-e bg-background md:flex md:flex-col">
        <div className="p-5">
          <AdminBrand storeName={storeName} />
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNavigation />
        </div>
        <div className="p-3">
          <Link
            href="/en"
            className="mb-3 flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ExternalLinkIcon className="size-4" />
            {t("viewStore")}
          </Link>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Avatar className="size-9">
              <AvatarFallback>{adminName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{adminName}</p>
              <p className="truncate text-xs text-muted-foreground">{adminEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <AdminBrand storeName={storeName} />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("openNavigation")}>
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="start" className="w-[19rem] p-0">
              <SheetHeader className="border-b p-5 text-start">
                <SheetTitle className="sr-only">{t("title")}</SheetTitle>
                <AdminBrand storeName={storeName} />
              </SheetHeader>
              <div className="p-3">
                <AdminNavigation />
              </div>
              <div className="mt-auto border-t p-3">
                <Link
                  href="/en"
                  className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <ExternalLinkIcon className="size-4" />
                  {t("viewStore")}
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-[96rem] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AdminShell };
