import { createTranslator } from "next-intl";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ReviewManager } from "@/components/admin/review-manager";
import { requireAdmin } from "@/lib/dal";
import { getAdminSnapshot } from "@/lib/data";
import messages from "@/messages/en.json";

export default async function AdminReviewsPage() {
  await requireAdmin();
  const t = createTranslator({ locale: "en", messages, namespace: "admin.reviews" });
  const snapshot = await getAdminSnapshot(90);
  const productsById = new Map(snapshot.products.map((product) => [product.id, product.titleEn]));
  const reviews = snapshot.reviews.map((review) => ({
    id: review.id,
    productId: review.productId,
    productTitle: review.product?.titleEn ?? productsById.get(review.productId) ?? t("unknownProduct"),
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    source: review.source,
    status: review.status,
    createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : review.createdAt,
  }));
  const products = snapshot.products.map((product) => ({ id: product.id, title: product.titleEn }));

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("subtitle")}
      />
      <ReviewManager reviews={reviews} products={products} />
    </>
  );
}
