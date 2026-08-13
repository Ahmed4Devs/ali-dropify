import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createTranslator } from "next-intl";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/dal";
import { getCategories } from "@/lib/data";
import messages from "@/messages/en.json";

export const metadata: Metadata = { title: messages.admin.productForm.createTitle };

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await getCategories();
  const t = createTranslator({ locale: "en", messages, namespace: "admin.productForm" });
  const common = createTranslator({ locale: "en", messages, namespace: "common" });

  return (
    <>
      <AdminPageHeader
        title={t("createTitle")}
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
      <ProductForm categories={categories} />
    </>
  );
}
