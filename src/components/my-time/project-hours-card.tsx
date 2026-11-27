import { useLocale, useTranslations } from "next-intl";
import type { ProjectHours } from "@/contracts";
import { useFormat } from "@/hooks/use-format";
import { summarizeProjectHours } from "./project-hours";

/** A15: hours per project for the month (caps were removed). Stream A only. */
export function ProjectHoursCard({ items, month }: { items: ProjectHours[]; month: string }) {
  const t = useTranslations("projectHours");
  const tc = useTranslations("common");
  const f = useFormat();
  const { rows, total } = summarizeProjectHours(items, useLocale());
  return (
    <section aria-labelledby="project-hours-title" className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="project-hours-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <span className="text-xs font-medium text-muted-foreground">{f.month(month)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <dl className="flex flex-col">
          {rows.map((r) => (
            <div key={r.projectId} className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
              <dt className="truncate font-medium">{r.projectName}</dt>
              <dd className="tabular font-medium">{tc("hours", { value: f.hours(r.hours) })}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-t border-foreground/20 pt-2 font-semibold">
            <dt>{t("total")}</dt>
            <dd className="tabular">{tc("hours", { value: f.hours(total) })}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
