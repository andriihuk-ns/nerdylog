import { useTranslations } from "next-intl";
import { capStatus, type CapStatus, type ProjectCapUsage } from "@/contracts";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";

const TRACK: Record<CapStatus, string> = {
  neutral: "bg-muted",
  warning: "bg-warning-subtle",
  over: "bg-pto-subtle",
};
const FILL: Record<CapStatus, string> = {
  neutral: "bg-foreground/60",
  warning: "bg-warning",
  over: "bg-pto",
};
const TEXT: Record<CapStatus, string> = {
  neutral: "text-foreground",
  warning: "text-warning",
  over: "text-pto",
};
/** docs/05 §6.1 cap telemetry: `DogTeamPro  32.0h / 40.0h · 80%` + 4px bar. Status via capStatus(). */
export function CapPill({ usage }: { usage: ProjectCapUsage }) {
  const { projectName, usedHours, capHours } = usage;
  const status = capStatus(usedHours, capHours);
  const t = useTranslations("caps");
  const f = useFormat();

  if (capHours === null || capHours <= 0) {
    return (
      <div className="flex items-baseline justify-between gap-3" aria-label={t("spokenNoCap", { project: projectName, hours: f.hours(usedHours) })}>
        <span className="truncate font-medium">{projectName}</span>
        <span className="tabular font-medium text-muted-foreground">{t("noCap", { hours: f.hours(usedHours) })}</span>
      </div>
    );
  }

  const ratio = usedHours / capHours;
  const over = usedHours - capHours;
  return (
    <div
      role="group"
      aria-label={t("spoken", {
        project: projectName,
        used: f.hours(usedHours),
        cap: f.hours(capHours),
        percent: Math.round(ratio * 100),
        status: t(`status.${status}`),
      })}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium">{projectName}</span>
        <span className={cn("tabular font-medium whitespace-nowrap", TEXT[status])}>
          {t("usage", { used: f.hours(usedHours), cap: f.hours(capHours), percent: f.percent(ratio) })}
        </span>
      </div>
      <div className={cn("h-1 w-full overflow-hidden rounded-full", TRACK[status])} aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-[var(--duration-base)] ease-standard", FILL[status])}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
      {status === "over" && over > 0 ? (
        <span className="tabular text-xs font-medium text-pto">{t("over", { hours: f.hours(over) })}</span>
      ) : null}
    </div>
  );
}
