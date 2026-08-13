import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { createTranslator } from "next-intl";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductList } from "@/components/admin/product-list";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/dal";
import { getCategories, getProducts } from "@/lib/data";
import messages from "@/messages/en.json";

export const metadata: Metadata = {
  title: messages.admin.products.title,
};

export default async function AdminProductsPage() {
  await requireAdmin();
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const t = createTranslator({ locale: "en", messages, namespace: "admin.products" });

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button asChild>
            <Link href="/admin/products/new">
              <PlusIcon />
              {t("addProduct")}
            </Link>
          </Button>
        }
      />
      <ProductList products={products} categories={categories} />
    </>
  );
}
