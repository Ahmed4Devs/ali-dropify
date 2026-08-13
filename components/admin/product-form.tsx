"use client";

import { useMemo, useState, useTransition } from "react";
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxesIcon,
  GripVerticalIcon,
  ImagePlusIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createProductAction,
  updateProductAction,
  uploadAdminImagesAction,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  FieldProps,
  OptionChoice,
  OptionDraft,
  ProductFormProps,
  VariantDraft,
  VariantData,
  VariantOptions,
} from "@/types";

function optionText(value: unknown, locale: "en" | "ar" = "en") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && locale in value) {
    const localized = (value as Record<string, unknown>)[locale];
    return typeof localized === "string" ? localized : "";
  }
  return "";
}

const noCategoryValue = "__none__";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function centsToDollars(value: number | null | undefined) {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  return Math.round(Number.parseFloat(value) * 100);
}

function splitValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function variantKey(options: VariantOptions) {
  return JSON.stringify(
    Object.entries(options).sort(([first], [second]) => first.localeCompare(second)),
  );
}

function productVariantsToDrafts(variants: VariantData[]): VariantDraft[] {
  return variants.map((variant, index) => ({
    id: variant.id || `saved-variant-${index}`,
    titleEn: variant.titleEn,
    titleAr: variant.titleAr,
    options: Object.fromEntries(
      Object.entries(variant.options).map(([key, value]) => [key, optionText(value)]),
    ),
    priceUsd: centsToDollars(variant.priceUsd),
    inStock: variant.inStock,
  }));
}

function productVariantsToOptions(variants: VariantData[]): OptionDraft[] {
  const keys: string[] = [];
  for (const variant of variants) {
    for (const key of Object.keys(variant.options)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  return keys.map((key, optionIndex) => {
    const englishValues: string[] = [];
    const arabicByEnglish = new Map<string, string>();
    for (const variant of variants) {
      const rawValue: unknown = variant.options[key];
      const english = optionText(rawValue);
      if (!english) continue;
      if (!englishValues.includes(english)) englishValues.push(english);
      const arabicParts = variant.titleAr.split(" / ");
      if (!arabicByEnglish.has(english)) {
        arabicByEnglish.set(
          english,
          optionText(rawValue, "ar") || arabicParts[optionIndex] || english,
        );
      }
    }

    return {
      id: `saved-option-${optionIndex}`,
      nameEn: titleCase(key),
      nameAr: titleCase(key),
      valuesEn: englishValues.join(", "),
      valuesAr: englishValues
        .map((value) => arabicByEnglish.get(value) ?? value)
        .join(", "),
    };
  });
}

function cartesianProduct(groups: OptionChoice[][]): OptionChoice[][] {
  return groups.reduce<OptionChoice[][]>(
    (combinations, group) =>
      combinations.flatMap((combination) =>
        group.map((choice) => [...combination, choice]),
      ),
    [[]],
  );
}

function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
            {icon}
          </span>
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1">{description}</CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const t = useTranslations("admin.productForm");
  const productT = useTranslations("admin.products");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const errors = useTranslations("errors");
  const mutationErrors = useTranslations("mutationErrors");
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [titleEn, setTitleEn] = useState(product?.titleEn ?? "");
  const [titleAr, setTitleAr] = useState(product?.titleAr ?? "");
  const [descriptionEn, setDescriptionEn] = useState(product?.descriptionEn ?? "");
  const [descriptionAr, setDescriptionAr] = useState(product?.descriptionAr ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugManual, setSlugManual] = useState(Boolean(product));
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [priceUsd, setPriceUsd] = useState(centsToDollars(product?.priceUsd));
  const [compareAtUsd, setCompareAtUsd] = useState(
    centsToDollars(product?.compareAtUsd),
  );
  const [costUsd, setCostUsd] = useState(centsToDollars(product?.costUsd ?? 0));
  const [inStock, setInStock] = useState(product?.inStock ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [aliexpressUrl, setAliexpressUrl] = useState(product?.aliexpressUrl ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [imageUrl, setImageUrl] = useState("");
  const [draggedImage, setDraggedImage] = useState<number | null>(null);
  const [options, setOptions] = useState<OptionDraft[]>(
    productVariantsToOptions(product?.variants ?? []),
  );
  const [variants, setVariants] = useState<VariantDraft[]>(
    productVariantsToDrafts(product?.variants ?? []),
  );

  const grossMargin = useMemo(() => {
    const price = Number.parseFloat(priceUsd);
    const cost = Number.parseFloat(costUsd);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(cost)) return null;
    return Math.round(((price - cost) / price) * 100);
  }, [costUsd, priceUsd]);

  function addImageUrl() {
    const nextUrl = imageUrl.trim();
    if (!nextUrl) return;
    try {
      const parsed = new URL(nextUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        toast.error(validation("url"));
        return;
      }
    } catch {
      toast.error(validation("url"));
      return;
    }
    if (!images.includes(nextUrl)) setImages((current) => [...current, nextUrl]);
    setImageUrl("");
  }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    setIsUploading(true);
    try {
      const result = await uploadAdminImagesAction(formData);
      if (!result.ok) {
        toast.error(mutationErrors(result.error));
        return;
      }
      setImages((current) => [
        ...current,
        ...result.data.urls.filter((url) => !current.includes(url)),
      ]);
    } catch {
      toast.error(errors("uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    setImages((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function dropImage(event: DragEvent<HTMLLIElement>, target: number) {
    event.preventDefault();
    if (draggedImage !== null) moveImage(draggedImage, target);
    setDraggedImage(null);
  }

  function addOption() {
    setOptions((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        nameEn: "",
        nameAr: "",
        valuesEn: "",
        valuesAr: "",
      },
    ]);
  }

  function updateOption(id: string, patch: Partial<Omit<OptionDraft, "id">>) {
    setOptions((current) =>
      current.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    );
  }

  function generateVariants() {
    const validOptions = options
      .map((option, optionIndex) => {
        const englishValues = splitValues(option.valuesEn);
        const arabicValues = splitValues(option.valuesAr);
        const key = slugify(option.nameEn) || `option-${optionIndex + 1}`;
        return {
          ...option,
          key,
          englishValues,
          arabicValues,
        };
      })
      .filter((option) => option.nameEn.trim() && option.englishValues.length);

    if (!validOptions.length) {
      setVariants([]);
      return;
    }

    const groups = validOptions.map((option) =>
      option.englishValues.map((valueEn, valueIndex) => ({
        key: option.key,
        valueEn,
        valueAr: option.arabicValues[valueIndex] || valueEn,
      })),
    );
    const existing = new Map(variants.map((variant) => [variantKey(variant.options), variant]));
    const combinations = cartesianProduct(groups);

    setVariants(
      combinations.map((combination) => {
        const variantOptions = Object.fromEntries(
          combination.map((choice) => [choice.key, choice.valueEn]),
        );
        const previous = existing.get(variantKey(variantOptions));
        return {
          id: previous?.id ?? crypto.randomUUID(),
          titleEn: combination.map((choice) => choice.valueEn).join(" / "),
          titleAr: combination.map((choice) => choice.valueAr).join(" / "),
          options: variantOptions,
          priceUsd: previous?.priceUsd ?? "",
          inStock: previous?.inStock ?? true,
        };
      }),
    );
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const priceInCents = dollarsToCents(priceUsd);
    const compareAtInCents = compareAtUsd.trim()
      ? dollarsToCents(compareAtUsd)
      : null;
    const costInCents = costUsd.trim() ? dollarsToCents(costUsd) : 0;
    if (!Number.isInteger(priceInCents) || priceInCents <= 0) {
      toast.error(validation("positive"));
      return;
    }
    if (!Number.isInteger(costInCents) || costInCents < 0) {
      toast.error(validation("nonNegative"));
      return;
    }

    const persistedVariantIds = new Set(
      product?.variants.map((variant) => variant.id) ?? [],
    );
    const input = {
      slug,
      titleEn,
      titleAr,
      descriptionEn,
      descriptionAr,
      priceUsd: priceInCents,
      compareAtUsd: compareAtInCents,
      costUsd: costInCents,
      images,
      tags: splitValues(tags).map((tag) => tag.toLowerCase()),
      inStock,
      isFeatured,
      aliexpressUrl: aliexpressUrl.trim() || null,
      categoryId: categoryId || null,
      variants: variants.map((variant) => {
        const localizedOptions = Object.fromEntries(
          Object.entries(variant.options).map(([key, value]) => {
            const option = options.find((entry) => slugify(entry.nameEn) === key);
            const valueIndex = option ? splitValues(option.valuesEn).indexOf(value) : -1;
            const valueAr = option && valueIndex >= 0
              ? splitValues(option.valuesAr)[valueIndex] ?? value
              : value;
            return [key, { en: value, ar: valueAr }];
          }),
        );
        const variantInput = {
          titleEn: variant.titleEn,
          titleAr: variant.titleAr,
          options: localizedOptions,
          priceUsd: variant.priceUsd.trim()
            ? dollarsToCents(variant.priceUsd)
            : null,
          inStock: variant.inStock,
        };
        return persistedVariantIds.has(variant.id)
          ? { ...variantInput, id: variant.id }
          : variantInput;
      }),
    };

    startTransition(async () => {
      const result = product
        ? await updateProductAction({ ...input, id: product.id })
        : await createProductAction(input);
      if (!result.ok) {
        toast.error(mutationErrors(result.error));
        return;
      }

      toast.success(product ? productT("updatedSuccess") : productT("createdSuccess"));
      router.push("/admin/products");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submitProduct} className="grid gap-6">
      <SectionCard title={t("basicSection")} icon={<BoxesIcon />}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="title-en" label={t("titleEn")}>
            <Input
              id="title-en"
              value={titleEn}
              required
              autoFocus
              onChange={(event) => {
                const nextTitle = event.target.value;
                setTitleEn(nextTitle);
                if (!slugManual) setSlug(slugify(nextTitle));
              }}
            />
          </Field>
          <Field id="title-ar" label={t("titleAr")}>
            <Input
              id="title-ar"
              dir="rtl"
              value={titleAr}
              required
              onChange={(event) => setTitleAr(event.target.value)}
            />
          </Field>
          <Field id="description-en" label={t("descriptionEn")}>
            <Textarea
              id="description-en"
              className="min-h-36"
              value={descriptionEn}
              required
              onChange={(event) => setDescriptionEn(event.target.value)}
            />
          </Field>
          <Field id="description-ar" label={t("descriptionAr")}>
            <Textarea
              id="description-ar"
              dir="rtl"
              className="min-h-36"
              value={descriptionAr}
              required
              onChange={(event) => setDescriptionAr(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field id="product-slug" label={t("slug")} hint={t("slugHint")}>
            <Input
              id="product-slug"
              value={slug}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              onChange={(event) => {
                setSlugManual(true);
                setSlug(slugify(event.target.value));
              }}
            />
          </Field>
          <div className="grid gap-2">
            <Label htmlFor="product-category">{t("category")}</Label>
            <Select
              value={categoryId || noCategoryValue}
              onValueChange={(value) =>
                setCategoryId(value === noCategoryValue ? "" : value)
              }
            >
              <SelectTrigger id="product-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noCategoryValue}>{t("noCategory")}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field id="product-tags" label={t("tags")}>
            <Input
              id="product-tags"
              value={tags}
              placeholder={t("tagsPlaceholder")}
              onChange={(event) => setTags(event.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={t("pricingSection")} icon={<SparklesIcon />}>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field id="price-usd" label={t("price")}>
            <Input
              id="price-usd"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={priceUsd}
              required
              onChange={(event) => setPriceUsd(event.target.value)}
            />
          </Field>
          <Field id="compare-at-usd" label={t("compareAt")}>
            <Input
              id="compare-at-usd"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={compareAtUsd}
              onChange={(event) => setCompareAtUsd(event.target.value)}
            />
          </Field>
          <Field
            id="cost-usd"
            label={t("cost")}
            hint={grossMargin === null ? undefined : `${t("cost")}: ${grossMargin}% margin`}
          >
            <Input
              id="cost-usd"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={costUsd}
              onChange={(event) => setCostUsd(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <Label htmlFor="product-stock" className="leading-snug">
              {t("inStock")}
            </Label>
            <Switch id="product-stock" checked={inStock} onCheckedChange={setInStock} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <Label htmlFor="product-featured" className="leading-snug">
              {t("featured")}
            </Label>
            <Switch
              id="product-featured"
              checked={isFeatured}
              onCheckedChange={setIsFeatured}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t("mediaSection")}
        description={t("imageHint")}
        icon={<ImagePlusIcon />}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
          <div className="grid gap-2">
            <Label htmlFor="image-url">{t("pasteImageUrl")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="image-url"
                type="url"
                value={imageUrl}
                placeholder={t("imageUrlPlaceholder")}
                onChange={(event) => setImageUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addImageUrl();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addImageUrl}>
                <PlusIcon />
                {t("addImageUrl")}
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image-files">{t("uploadImages")}</Label>
            <div className="relative">
              <Input
                id="image-files"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={isUploading}
                className="pe-10"
                onChange={uploadImages}
              />
              <UploadIcon className="pointer-events-none absolute end-3 top-2.5 size-4 text-muted-foreground" />
            </div>
            {isUploading ? (
              <p className="text-xs text-muted-foreground">{common("loading")}</p>
            ) : null}
          </div>
        </div>

        {images.length ? (
          <div className="mt-6">
            <p className="mb-3 text-xs text-muted-foreground">{t("reorderImages")}</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {images.map((image, index) => (
                <li
                  key={`${image}-${index}`}
                  draggable
                  onDragStart={() => setDraggedImage(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropImage(event, index)}
                  onDragEnd={() => setDraggedImage(null)}
                  className="group overflow-hidden rounded-xl border bg-card"
                >
                  <div className="relative aspect-square bg-muted">
                    <Image
                      src={image}
                      alt={`${titleEn || t("mediaSection")} ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 180px"
                      className="object-cover"
                    />
                    {index === 0 ? (
                      <span className="absolute start-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold shadow-sm">
                        1
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-1 p-1.5">
                    <GripVerticalIcon className="size-4 cursor-grab text-muted-foreground" />
                    <div className="flex gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        aria-label={`${common("previous")} ${index + 1}`}
                        onClick={() => moveImage(index, index - 1)}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === images.length - 1}
                        aria-label={`${common("next")} ${index + 1}`}
                        onClick={() => moveImage(index, index + 1)}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={t("removeImage", { index: index + 1 })}
                        onClick={() =>
                          setImages((current) =>
                            current.filter((_, imageIndex) => imageIndex !== index),
                          )
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={t("variantsSection")} icon={<BoxesIcon />}>
        <div className="grid gap-3">
          {options.map((option, index) => (
            <div key={option.id} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2">
              <Field
                id={`option-name-en-${option.id}`}
                label={`${t("optionName")} · English`}
              >
                <Input
                  id={`option-name-en-${option.id}`}
                  value={option.nameEn}
                  placeholder={t("optionExample")}
                  onChange={(event) =>
                    updateOption(option.id, { nameEn: event.target.value })
                  }
                />
              </Field>
              <Field
                id={`option-name-ar-${option.id}`}
                label={`${t("optionName")} · ${t("arabicLanguage")}`}
              >
                <Input
                  id={`option-name-ar-${option.id}`}
                  dir="rtl"
                  value={option.nameAr}
                  placeholder={t("optionExampleAr")}
                  onChange={(event) =>
                    updateOption(option.id, { nameAr: event.target.value })
                  }
                />
              </Field>
              <Field
                id={`option-values-en-${option.id}`}
                label={`${t("optionValues")} · English`}
              >
                <Input
                  id={`option-values-en-${option.id}`}
                  value={option.valuesEn}
                  placeholder={t("valuesExample")}
                  onChange={(event) =>
                    updateOption(option.id, { valuesEn: event.target.value })
                  }
                />
              </Field>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field
                    id={`option-values-ar-${option.id}`}
                    label={`${t("optionValues")} · ${t("arabicLanguage")}`}
                  >
                    <Input
                      id={`option-values-ar-${option.id}`}
                      dir="rtl"
                      value={option.valuesAr}
                      placeholder={t("valuesExampleAr")}
                      onChange={(event) =>
                        updateOption(option.id, { valuesAr: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label={`${common("remove")} ${index + 1}`}
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((entry) => entry.id !== option.id),
                    )
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={addOption}>
            <PlusIcon />
            {t("addOption")}
          </Button>
          <Button type="button" variant="secondary" onClick={generateVariants}>
            <SparklesIcon />
            {t("generateVariants")}
          </Button>
        </div>

        {variants.length ? (
          <div className="mt-6 overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("variantName")}</TableHead>
                  <TableHead>{t("priceOverride")}</TableHead>
                  <TableHead>{t("variantStock")}</TableHead>
                  <TableHead className="text-end">{common("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="min-w-52 whitespace-normal">
                      <p className="font-medium">{variant.titleEn}</p>
                      <p dir="rtl" className="mt-0.5 text-start text-xs text-muted-foreground">
                        {variant.titleAr}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={variant.priceUsd}
                        placeholder={priceUsd || "0.00"}
                        aria-label={`${t("priceOverride")} ${variant.titleEn}`}
                        onChange={(event) =>
                          setVariants((current) =>
                            current.map((entry) =>
                              entry.id === variant.id
                                ? { ...entry, priceUsd: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={variant.inStock}
                        aria-label={`${t("variantStock")} ${variant.titleEn}`}
                        onCheckedChange={(checked) =>
                          setVariants((current) =>
                            current.map((entry) =>
                              entry.id === variant.id
                                ? { ...entry, inStock: checked }
                                : entry,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`${common("remove")} ${variant.titleEn}`}
                          onClick={() =>
                            setVariants((current) =>
                              current.filter((entry) => entry.id !== variant.id),
                            )
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("noVariants")}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("sourceSection")} icon={<UploadIcon />}>
        <Field id="aliexpress-url" label={t("aliexpressUrl")}>
          <Input
            id="aliexpress-url"
            type="url"
            value={aliexpressUrl}
            placeholder={t("aliexpressUrlPlaceholder")}
            onChange={(event) => setAliexpressUrl(event.target.value)}
          />
        </Field>
      </SectionCard>

      <div className="flex flex-col-reverse gap-3 rounded-xl border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-end">
        <Button asChild variant="outline" disabled={isPending || isUploading}>
          <Link href="/admin/products">{common("cancel")}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isPending || isUploading}>
          {isPending
            ? common("saving")
            : product
              ? t("saveProduct")
              : t("createProduct")}
        </Button>
      </div>
    </form>
  );
}

export { ProductForm };
