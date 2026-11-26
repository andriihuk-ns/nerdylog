import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  rows: number;
  cols: number;
  label: string;
  firstCol?: string; // width class for the sticky name column
}

/** docs/05 §6 loading: skeleton rows with the final grid geometry, no spinner. */
export function GridSkeleton({ rows, cols, label, firstCol = "w-[200px]" }: Props) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-lg border bg-card">
      <div className="flex h-10 items-center gap-3 border-b px-4">
        <Skeleton className={`h-3 ${firstCol} max-w-[40%] shrink-0`} />
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="ml-auto h-3 w-10" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-11 items-center gap-3 border-b px-4 last:border-b-0">
          <Skeleton className={`h-4 ${firstCol} max-w-[40%] shrink-0`} />
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className="ml-auto h-4 w-10" />
          ))}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-72" />
    </div>
  );
}
