import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import type { CheckinView, IsoDate } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listCheckinsForDate } from "@/server/services/checkin-service";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayLong } from "@/components/lib/dates";
import { RefreshButton } from "@/components/shell/refresh-button";
import { StandupCard } from "./standup-card";
import { groupStandups, type RosterMember } from "./team-summary";

/** Fetches Stream B check-ins for the drawer. Errors stay inside the drawer (inline retry). */
export async function StandupList({ date, roster }: { date: IsoDate; roster: RosterMember[] }) {
  const [t, locale] = await Promise.all([getTranslations("standups"), getLocale()]);
  let checkins: CheckinView[];
  try {
    const actor = await requireActor();
    checkins = await listCheckinsForDate(actor, date);
  } catch (err) {
    unstable_rethrow(err);
    console.error("standup drawer: listCheckinsForDate failed", err instanceof Error ? err.message : err);
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <p>{t("loadFailed")}</p>
        <RefreshButton />
      </div>
    );
  }

  const { blockers, plans, missing } = groupStandups(checkins, roster);
  return (
    <>
      {blockers.length > 0 ? (
        <section aria-labelledby="blockers-title" className="flex flex-col gap-3">
          <h3 id="blockers-title" className="text-xs font-medium text-muted-foreground">
            {t("blockers")} · <span className="tabular">{blockers.length}</span>
          </h3>
          {blockers.map((c) => (
            <StandupCard key={c.userId} checkin={c} variant="blocker" />
          ))}
        </section>
      ) : null}
      <section aria-labelledby="plans-title" className="flex flex-col gap-3">
        <h3 id="plans-title" className="text-xs font-medium text-muted-foreground">
          {t("plans")}
        </h3>
        {plans.length === 0 ? <p className="text-muted-foreground">{t("empty", { day: formatDayLong(date, locale) })}</p> : null}
        {plans.map((c) => (
          <StandupCard key={c.userId} checkin={c} variant="plan" />
        ))}
      </section>
      {missing.length > 0 ? (
        <ul aria-label={t("missingLabel")} className="flex flex-col gap-1 border-t pt-4 text-muted-foreground">
          {missing.map((m) => (
            <li key={m.userId} className="flex justify-between gap-2">
              <span>{m.fullName}</span>
              <span className="text-xs">{t("missing")}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function StandupListSkeleton() {
  const t = useTranslations("loading");
  return (
    <div role="status" aria-label={t("standups")} className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
