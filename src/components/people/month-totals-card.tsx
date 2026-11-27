import { useTranslations } from "next-intl";
import type { RollupTotals } from "@/contracts";
import { useFormat } from "@/hooks/use-format";

/** A15 people page: the person's month totals from the team rollup (Stream A only). */
export function MonthTotalsCard({ totals, month }: { totals: RollupTotals | null; month: string }) {
  const t = useTranslations("people.totals");
  const tc = useTranslations("common");
  const f = useFormat();
  const stats = totals
    ? [
        { label: t("hours"), value: tc("hours", { value: f.hours(totals.hours) }) },
        { label: t("days"), value: f.days(totals.days) },
        { label: t("vacSick"), value: f.count(totals.vacSick) },
        { label: t("holidays"), value: f.count(totals.holidays) },
      ]
    : [];
  return (
    <section aria-labelledby="month-totals-title" className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="month-totals-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <span className="text-xs font-medium text-muted-foreground">{f.month(month)}</span>
      </div>
      {stats.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
              <dd className="tabular text-xl font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
