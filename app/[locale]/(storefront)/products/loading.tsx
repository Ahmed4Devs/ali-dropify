import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="container-shell py-10 sm:py-14">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-4 h-5 w-96 max-w-full" />
      <div className="mt-8 flex gap-2 border-y py-5">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-24 rounded-full" />)}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index}><Skeleton className="aspect-[4/5] rounded-xl" /><Skeleton className="mt-3 h-4 w-4/5" /><Skeleton className="mt-2 h-5 w-2/5" /></div>)}
      </div>
    </div>
  );
}
