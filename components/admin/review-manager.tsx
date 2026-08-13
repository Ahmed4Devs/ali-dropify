"use client";

import { useMemo, useState, useTransition } from "react";
import { MessageSquareOffIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  importAliExpressReviewsAction,
  updateReviewStatusAction,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function ReviewManager({
  reviews,
  products,
}: {
  reviews: {
    id: string;
    productId: string;
    productTitle: string;
    authorName: string;
    rating: number;
    comment: string;
    source: string;
    status: string;
    createdAt: string;
  }[];
  products: { id: string; title: string }[];
}) {
  const t = useTranslations("admin.reviews");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [format, setFormat] = useState<"JSON" | "CSV">("JSON");
  const [data, setData] = useState("");
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reviewStatusLabel(status: string) {
    if (status === "PENDING") return statusT("review.pending");
    if (status === "APPROVED") return statusT("review.approved");
    if (status === "HIDDEN") return statusT("review.hidden");
    return status;
  }

  function reviewSourceLabel(source: string) {
    if (source === "ALIEXPRESS") return statusT("reviewSource.aliexpress");
    if (source === "STORE") return statusT("reviewSource.store");
    return source;
  }

  const filtered = useMemo(
    () =>
      reviews.filter(
        (review) =>
          (statusFilter === "ALL" || review.status === statusFilter) &&
          (sourceFilter === "ALL" || review.source === sourceFilter),
      ),
    [reviews, sourceFilter, statusFilter],
  );

  function moderate(reviewId: string, status: "APPROVED" | "HIDDEN") {
    setPendingReviewId(reviewId);
    startTransition(async () => {
      const result = await updateReviewStatusAction({ reviewId, status });
      setPendingReviewId(null);
      if (!result.ok) {
        toast.error(t("moderationFailed"));
        return;
      }
      toast.success(status === "APPROVED" ? t("approvedSuccess") : t("hiddenSuccess"));
    });
  }

  function importReviews() {
    startTransition(async () => {
      const result = await importAliExpressReviewsAction({
        productId,
        format: format === "CSV" ? "csv" : "json",
        data,
      });
      if (!result.ok) {
        toast.error(t("importFailed"));
        return;
      }
      toast.success(t("importedSuccess", { count: result.data.count }));
      setData("");
      setDialogOpen(false);
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="grid gap-1.5 text-xs text-muted-foreground">
            {t("filterStatus")}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full min-w-40"><SelectValue placeholder={t("allStatuses")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("allStatuses")}</SelectItem>
                <SelectItem value="PENDING">{reviewStatusLabel("PENDING")}</SelectItem>
                <SelectItem value="APPROVED">{reviewStatusLabel("APPROVED")}</SelectItem>
                <SelectItem value="HIDDEN">{reviewStatusLabel("HIDDEN")}</SelectItem>
              </SelectContent>
            </Select>
          </Label>
          <Label className="grid gap-1.5 text-xs text-muted-foreground">
            {t("filterSource")}
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full min-w-40"><SelectValue placeholder={t("allSources")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("allSources")}</SelectItem>
                <SelectItem value="STORE">{reviewSourceLabel("STORE")}</SelectItem>
                <SelectItem value="ALIEXPRESS">{reviewSourceLabel("ALIEXPRESS")}</SelectItem>
              </SelectContent>
            </Select>
          </Label>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button>{t("import")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("importTitle")}</DialogTitle>
              <DialogDescription>{t("importDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Label className="grid gap-2">
                {t("product")}
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                  <SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.title}</SelectItem>)}</SelectContent>
                </Select>
              </Label>
              <div className="grid gap-2">
                <Label>{t("format")}</Label>
                <Tabs value={format} onValueChange={(value) => setFormat(value === "CSV" ? "CSV" : "JSON")}>
                  <TabsList className="w-full"><TabsTrigger value="JSON">{t("json")}</TabsTrigger><TabsTrigger value="CSV">{t("csv")}</TabsTrigger></TabsList>
                </Tabs>
              </div>
              <Label className="grid gap-2">
                {t("data")}
                <Textarea
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  rows={10}
                  placeholder={format === "JSON" ? t("jsonPlaceholder") : t("csvPlaceholder")}
                  className="font-mono text-xs"
                />
                <span className="text-xs font-normal text-muted-foreground">{t("expectedColumns")}</span>
              </Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{common("cancel")}</Button>
              <Button disabled={!productId || !data.trim() || isPending} onClick={importReviews}>{isPending ? t("importing") : t("importAction")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead>{t("author")}</TableHead><TableHead>{t("rating")}</TableHead><TableHead className="min-w-64">{t("comment")}</TableHead><TableHead>{t("source")}</TableHead><TableHead>{common("status")}</TableHead><TableHead className="text-end">{common("actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((review) => (
              <TableRow key={review.id}>
                <TableCell><p className="max-w-44 truncate font-medium">{review.productTitle}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(review.createdAt))}</p></TableCell>
                <TableCell>{review.authorName}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1"><StarIcon className="size-3.5 fill-amber-400 text-amber-400" />{review.rating}</span></TableCell>
                <TableCell><p className="line-clamp-2 max-w-md whitespace-normal text-sm text-muted-foreground">{review.comment}</p></TableCell>
                <TableCell><Badge variant="outline">{reviewSourceLabel(review.source)}</Badge></TableCell>
                <TableCell><Badge variant={review.status === "APPROVED" ? "success" : review.status === "HIDDEN" ? "destructive" : "warning"}>{reviewStatusLabel(review.status)}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={pendingReviewId === review.id} onClick={() => moderate(review.id, "APPROVED")}>{t("approve")}</Button>
                    <Button size="sm" variant="ghost" disabled={pendingReviewId === review.id} onClick={() => moderate(review.id, "HIDDEN")}>{t("hide")}</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!filtered.length ? <div className="flex flex-col items-center gap-2 px-6 py-16 text-center"><MessageSquareOffIcon className="size-8 text-muted-foreground" /><p className="font-medium">{t("emptyTitle")}</p><p className="text-sm text-muted-foreground">{t("emptyDescription")}</p></div> : null}
      </div>
    </>
  );
}

export { ReviewManager };
