import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { createTranslator } from "next-intl";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/dal";
import { getAdminProducts, getCategories } from "@/lib/data";
import messages from "@/messages/en.json";

export const metadata: Metadata = { title: messages.admin.productForm.editTitle };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [products, categories] = await Promise.all([getAdminProducts(), getCategories()]);
  const t = createTranslator({ locale: "en", messages, namespace: "admin.productForm" });
  const common = createTranslator({ locale: "en", messages, namespace: "common" });
  const product = products.find((entry) => entry.id === id);

  if (!product) notFound();

  return (
    <>
      <AdminPageHeader
        title={t("editTitle")}
        description={t("subtitle")}
        action={
          <Button asChild variant="outline">
            <Link href="/admin/products">
              <ArrowLeftIcon />
              {common("back")}
            </Link>
          </Button>
        }
      />
      <ProductForm categories={categories} product={product} />
    </>
  );
}
