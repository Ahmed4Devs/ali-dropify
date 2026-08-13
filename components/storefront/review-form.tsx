"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { submitReviewAction } from "@/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewFormProps } from "@/types";

export function ReviewForm({ locale, productId }: ReviewFormProps) {
  const t = useTranslations("product.reviews");
  const mutationErrors = useTranslations("mutationErrors");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await submitReviewAction({ productId, rating, comment, locale });
      if (result.ok) {
        setComment("");
        toast.success(t("submitted"));
      } else toast.error(mutationErrors(result.error));
    });
  }

  return (
    <form className="mt-8 rounded-xl border bg-card p-5" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <h3 className="font-bold">{t("writeTitle")}</h3>
      <div className="mt-4 flex gap-1" role="radiogroup" aria-label={t("ratingLabel")}>
        {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
          <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} className="p-1 text-amber-500">
            <Star className={`size-6 ${value <= rating ? "fill-current" : ""}`} />
          </button>
        ))}
      </div>
      <Textarea className="mt-4 min-h-28" required minLength={10} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t("commentPlaceholder")} />
      <Button type="submit" className="mt-4" disabled={pending || comment.trim().length < 10}>{pending ? t("submitting") : t("submit")}</Button>
    </form>
  );
}
