import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { GridSkeleton, HeaderSkeleton } from "@/components/shell/grid-skeleton";

export default function PersonLoading() {
  const t = useTranslations("loading");
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-3" aria-hidden>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
      <GridSkeleton rows={5} cols={8} label={t("myTime")} />
    </div>
  );
}
