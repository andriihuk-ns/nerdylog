import { GridSkeleton, HeaderSkeleton } from "@/components/shell/grid-skeleton";

export default function TeamLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      {/* 5 month-weeks + total, 4 sub-columns each */}
      <GridSkeleton rows={6} cols={12} firstCol="w-[220px]" label="Loading team summary" />
    </div>
  );
}
