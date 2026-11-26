import { Skeleton } from "@/components/ui/skeleton";
import { GridSkeleton } from "@/components/shell/grid-skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" aria-hidden />
      <Skeleton className="h-11 w-80" aria-hidden />
      <GridSkeleton rows={6} cols={4} label="Loading admin" />
    </div>
  );
}
