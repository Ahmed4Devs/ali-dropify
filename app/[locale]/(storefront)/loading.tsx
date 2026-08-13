import { Skeleton } from "@/components/ui/skeleton";

export default function StoreLoading() {
  return <div className="container-shell py-8"><Skeleton className="min-h-[34rem] rounded-2xl" /><div className="mt-12 grid grid-cols-3 gap-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="aspect-[3/4] rounded-xl sm:aspect-[4/3]" />)}</div></div>;
}
