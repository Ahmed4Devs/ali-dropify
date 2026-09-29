"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BoxesIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createCategoryAction,
  deleteCategoryAction,
  deleteProductAction,
  updateCategoryAction,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUsdPrice } from "@/lib/currency";
import type { CategoryData, CategoryDraft, ProductData, ProductListProps } from "@/types";

const emptyCategory: CategoryDraft = {
  id: null,
  slug: "",
  nameEn: "",
  nameAr: "",
  image: "",
  sort: "0",
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ProductList({ products, categories }: ProductListProps) {
  const router = useRouter();
  const t = useTranslations("admin.products");
  const categoryT = useTranslations("admin.categories");
  const common = useTranslations("common");
  const mutationErrors = useTranslations("mutationErrors");
  const [isPending, startTransition] = useTransition();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategory);
  const [categorySlugManual, setCategorySlugManual] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductData | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryData | null>(null);

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.categoryId) {
        counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
      }
    }
    return counts;
  }, [products]);

  function openNewCategory() {
    setCategoryDraft(emptyCategory);
    setCategorySlugManual(false);
    setCategoryDialogOpen(true);
  }

  function openEditCategory(category: CategoryData) {
    setCategoryDraft({
      id: category.id,
      slug: category.slug,
      nameEn: category.nameEn,
      nameAr: category.nameAr,
      image: category.image ?? "",
      sort: String(category.sort),
    });
    setCategorySlugManual(true);
    setCategoryDialogOpen(true);
  }

  function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      slug: categoryDraft.slug,
      nameEn: categoryDraft.nameEn,
      nameAr: categoryDraft.nameAr,
      image: categoryDraft.image.trim() || null,
      sort: Number.parseInt(categoryDraft.sort, 10) || 0,
    };

    startTransition(async () => {
      const result = categoryDraft.id
        ? await updateCategoryAction({ ...input, id: categoryDraft.id })
        : await createCategoryAction(input);

      if (!result.ok) {
        toast.error(mutationErrors(result.error));
        return;
      }

      toast.success(
        categoryDraft.id
          ? categoryT("updatedSuccess")
          : categoryT("createdSuccess"),
      );
      setCategoryDialogOpen(false);
      router.refresh();
    });
  }

  function confirmProductDelete() {
    if (!productToDelete) return;
    startTransition(async () => {
      const result = await deleteProductAction({ id: productToDelete.id });
      if (!result.ok) {
        toast.error(mutationErrors(result.error));
        return;
      }
      toast.success(t("deletedSuccess"));
      setProductToDelete(null);
      router.refresh();
    });
  }

  function confirmCategoryDelete() {
    if (!categoryToDelete) return;
    startTransition(async () => {
      const result = await deleteCategoryAction({ id: categoryToDelete.id });
      if (!result.ok) {
        toast.error(mutationErrors(result.error));
        return;
      }
      toast.success(categoryT("deletedSuccess"));
      setCategoryToDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <Tabs defaultValue="products" className="gap-5">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="products" className="flex-1 sm:flex-none">
            <BoxesIcon />
            {t("productTab")}
            <Badge variant="secondary" className="ms-1">
              {products.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex-1 sm:flex-none">
            <FolderIcon />
            {t("categoryTab")}
            <Badge variant="secondary" className="ms-1">
              {categories.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {products.length ? (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("thumbnail")}</TableHead>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead>{t("visibility")}</TableHead>
                    <TableHead>{common("price")}</TableHead>
                    <TableHead>{t("cost")}</TableHead>
                    <TableHead>{t("margin")}</TableHead>
                    <TableHead>{t("stock")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead>{common("featured")}</TableHead>
                    <TableHead>{t("created")}</TableHead>
                    <TableHead className="text-end">{common("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const margin = product.priceUsd
                      ? Math.round(
                          ((product.priceUsd - product.costUsd) / product.priceUsd) *
                            100,
                        )
                      : 0;
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="relative size-12 overflow-hidden rounded-lg border bg-muted">
                            {product.images[0] ? (
                              <Image
                                src={product.images[0]}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <BoxesIcon className="absolute inset-0 m-auto size-5 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-normal">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {product.titleEn}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            /{product.slug}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.isPublished ? "success" : "secondary"}>
                            {product.isPublished ? t("published") : t("draft")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatUsdPrice(product.priceUsd, "USD", "en")}
                        </TableCell>
                        <TableCell>
                          {formatUsdPrice(product.costUsd, "USD", "en")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              margin > 0 ? "text-emerald-700" : "text-muted-foreground"
                            }
                          >
                            {margin}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.inStock ? "success" : "destructive"}>
                            {product.inStock ? common("inStock") : common("outOfStock")}
                          </Badge>
                        </TableCell>
                        <TableCell>{product.category?.nameEn ?? common("none")}</TableCell>
                        <TableCell>
                          {product.isFeatured ? (
                            <SparklesIcon
                              className="size-4 text-amber-500"
                              aria-label={common("featured")}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Intl.DateTimeFormat("en-US", {
                            dateStyle: "medium",
                          }).format(new Date(product.createdAt))}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon-sm">
                              <Link
                                href={`/admin/products/${product.id}`}
                                aria-label={`${common("edit")} ${product.titleEn}`}
                              >
                                <PencilIcon />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              aria-label={`${common("delete")} ${product.titleEn}`}
                              onClick={() => setProductToDelete(product)}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <EmptyCatalog
              icon={<BoxesIcon />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={
                <Button asChild>
                  <Link href="/admin/products/new">
                    <PlusIcon />
                    {t("addProduct")}
                  </Link>
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="categories">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{categoryT("title")}</h2>
              <p className="text-sm text-muted-foreground">{categoryT("subtitle")}</p>
            </div>
            <Button type="button" onClick={openNewCategory}>
              <PlusIcon />
              {categoryT("add")}
            </Button>
          </div>
          {categories.length ? (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{common("image")}</TableHead>
                    <TableHead>{categoryT("nameEn")}</TableHead>
                    <TableHead>{categoryT("nameAr")}</TableHead>
                    <TableHead>{categoryT("slug")}</TableHead>
                    <TableHead>{categoryT("sort")}</TableHead>
                    <TableHead>{common("items")}</TableHead>
                    <TableHead className="text-end">{common("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="relative size-11 overflow-hidden rounded-lg border bg-muted">
                          {category.image ? (
                            <Image
                              src={category.image}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          ) : (
                            <FolderIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{category.nameEn}</TableCell>
                      <TableCell dir="rtl" className="text-start">
                        {category.nameAr}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{category.slug}</TableCell>
                      <TableCell>{category.sort}</TableCell>
                      <TableCell>
                        {categoryT("productCount", {
                          count: productCounts.get(category.id) ?? 0,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${common("edit")} ${category.nameEn}`}
                            onClick={() => openEditCategory(category)}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`${common("delete")} ${category.nameEn}`}
                            onClick={() => setCategoryToDelete(category)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <EmptyCatalog
              icon={<FolderIcon />}
              title={categoryT("empty")}
              description={categoryT("subtitle")}
              action={
                <Button type="button" onClick={openNewCategory}>
                  <PlusIcon />
                  {categoryT("add")}
                </Button>
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) {
            setCategoryDraft(emptyCategory);
            setCategorySlugManual(false);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={saveCategory}>
            <DialogHeader>
              <DialogTitle>
                {categoryDraft.id ? categoryT("edit") : categoryT("add")}
              </DialogTitle>
              <DialogDescription>{categoryT("subtitle")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              <div className="grid gap-2">
                <Label htmlFor="category-name-en">{categoryT("nameEn")}</Label>
                <Input
                  id="category-name-en"
                  value={categoryDraft.nameEn}
                  required
                  autoFocus
                  onChange={(event) => {
                    const nameEn = event.target.value;
                    setCategoryDraft((current) => ({
                      ...current,
                      nameEn,
                      slug: categorySlugManual ? current.slug : slugify(nameEn),
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category-name-ar">{categoryT("nameAr")}</Label>
                <Input
                  id="category-name-ar"
                  dir="rtl"
                  value={categoryDraft.nameAr}
                  required
                  onChange={(event) =>
                    setCategoryDraft((current) => ({
                      ...current,
                      nameAr: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category-slug">{categoryT("slug")}</Label>
                <Input
                  id="category-slug"
                  value={categoryDraft.slug}
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => {
                    setCategorySlugManual(true);
                    setCategoryDraft((current) => ({
                      ...current,
                      slug: slugify(event.target.value),
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <div className="grid gap-2">
                  <Label htmlFor="category-image">{categoryT("imageUrl")}</Label>
                  <Input
                    id="category-image"
                    type="url"
                    value={categoryDraft.image}
                    onChange={(event) =>
                      setCategoryDraft((current) => ({
                        ...current,
                        image: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category-sort">{categoryT("sort")}</Label>
                  <Input
                    id="category-sort"
                    type="number"
                    step="1"
                    value={categoryDraft.sort}
                    onChange={(event) =>
                      setCategoryDraft((current) => ({
                        ...current,
                        sort: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setCategoryDialogOpen(false)}
              >
                {common("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? common("saving")
                  : categoryDraft.id
                    ? common("update")
                    : common("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setProductToDelete(null)}
            >
              {common("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmProductDelete}
            >
              {isPending ? common("deleting") : common("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(categoryToDelete)}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryT("deleteTitle")}</DialogTitle>
            <DialogDescription>{categoryT("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setCategoryToDelete(null)}
            >
              {common("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmCategoryDelete}
            >
              {isPending ? common("deleting") : common("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmptyCatalog({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        <div className="mt-5">{action}</div>
      </CardContent>
    </Card>
  );
}

export { ProductList };
