import { Skeleton } from "@/components/ui/skeleton";
import { GridSkeleton, HeaderSkeleton } from "@/components/shell/grid-skeleton";

export default function MyTimeLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <HeaderSkeleton />
        <GridSkeleton rows={5} cols={8} label="Loading your week" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" aria-hidden>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </div>
  );
}
