import { useLocale, useTranslations } from "next-intl";
import type { ProjectCapUsage } from "@/contracts";
import { useFormat } from "@/hooks/use-format";
import { CapPill } from "./cap-pill";

/** Client caps for the month (team-wide usage per project, FR-WEB-03). */
export function CapPills({ caps, month }: { caps: ProjectCapUsage[]; month: string }) {
  const t = useTranslations("caps");
  const f = useFormat();
  const locale = useLocale();
  const sorted = [...caps].sort((a, b) => a.projectName.localeCompare(b.projectName, locale));
  return (
    <section aria-labelledby="caps-title" className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="caps-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <span className="text-xs font-medium text-muted-foreground">{t("scope", { month: f.month(month) })}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {sorted.map((c) => (
            <li key={c.projectId}>
              <CapPill usage={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
