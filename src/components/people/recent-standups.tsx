import { useTranslations } from "next-intl";
import type { CheckinView } from "@/contracts";
import { useFormat } from "@/hooks/use-format";
import { StandupCard } from "@/components/team/standup-card";

/** A15 people page: the last 14 days of standups (Stream B, display only; never summed). */
export function RecentStandups({ checkins }: { checkins: CheckinView[] }) {
  const t = useTranslations("people.standups");
  const f = useFormat();
  const sorted = [...checkins].sort((a, b) => b.checkinDate.localeCompare(a.checkinDate));
  return (
    <section aria-labelledby="recent-standups-title" className="flex flex-col gap-3">
      <h2 id="recent-standups-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      {sorted.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {sorted.map((c) => (
            <li key={c.checkinDate} className="flex flex-col gap-2">
              <time dateTime={c.checkinDate} className="tabular text-xs font-medium text-muted-foreground">
                {f.dayLong(c.checkinDate)}
              </time>
              <StandupCard checkin={c} variant="plan" />
              {c.hasBlocker ? <StandupCard checkin={c} variant="blocker" /> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
