import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { extractTicketRefs, type CheckinView } from "@/contracts";
import { cn } from "@/lib/utils";
import { initials } from "@/components/lib/format";
import { ArtifactText } from "@/components/shell/artifact-text";

/** Stream B card. Text only: no hours, totals or caps, ever (docs/05 §6.4). */
export function StandupCard({ checkin, variant }: { checkin: CheckinView; variant: "plan" | "blocker" }) {
  const text = variant === "blocker" ? checkin.blockers : checkin.plannedToday;
  const refs = extractTicketRefs(text);
  const t = useTranslations("standups");
  return (
    <article
      data-standup-card
      tabIndex={0}
      aria-label={t(variant === "blocker" ? "cardBlocker" : "cardPlan", { name: checkin.fullName })}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "blocker" ? "border-l-2 border-l-warning bg-warning-subtle" : "bg-card",
      )}
    >
      <header className="flex items-center gap-2">
        {checkin.avatarUrl ? (
          // Slack avatar URLs are external and tiny; next/image would need remotePatterns config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={checkin.avatarUrl} alt="" className="size-6 rounded-full" />
        ) : (
          <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
            {initials(checkin.fullName)}
          </span>
        )}
        <span className="font-medium">{checkin.fullName}</span>
        {variant === "blocker" ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-warning">
            <AlertTriangle className="size-3.5" aria-hidden />
            {t("blocker")}
          </span>
        ) : null}
      </header>
      <p className={cn("text-[15px] leading-[22px]", variant === "blocker" && "text-warning")}>
        {text.trim() ? <ArtifactText text={text} /> : <span className="text-muted-foreground">{t("noPlan")}</span>}
      </p>
      {refs.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label={t("tickets")}>
          {refs.map((r) => (
            <li key={r} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {r}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
