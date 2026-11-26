import { useTranslations } from "next-intl";
import { GridSkeleton, HeaderSkeleton } from "@/components/shell/grid-skeleton";

export default function TeamLoading() {
  const t = useTranslations("loading");
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      {/* 5 month-weeks + total, 4 sub-columns each */}
      <GridSkeleton rows={6} cols={12} firstCol="w-[220px]" label={t("team")} />
    </div>
  );
}
