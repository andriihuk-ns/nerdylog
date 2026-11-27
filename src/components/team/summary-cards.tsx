"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MonthWeek, UserMonthRollup } from "@/contracts";
import { cn } from "@/lib/utils";
import { initials, orDot } from "@/components/lib/format";
import { useFormat } from "@/hooks/use-format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { bucketValues, SUB_COLUMNS, teamTotals } from "./team-summary";

interface Props {
  rows: UserMonthRollup[];
  weeks: MonthWeek[];
  avatars: Record<string, string | null>;
  selfId: string;
}

type Bucket = Parameters<typeof bucketValues>[0];

/** Phone layout of the Summary matrix (below `md`): monthly totals per person, weeks on demand. */
export function SummaryCards({ rows, weeks, avatars, selfId }: Props) {
  const totals = teamTotals(rows, weeks.length);
  const t = useTranslations("team.grid");
  const tTeam = useTranslations("team");
  const f = useFormat();

  return (
    <ul className="flex flex-col gap-3 md:hidden" aria-label={t("label")}>
      {rows.map((row) => (
        <li key={row.userId} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
          <Link
            href={row.userId === selfId ? "/my-time" : `/people/${row.userId}?from=team`}
            title={tTeam("open", { name: row.fullName })}
            className="flex min-h-11 items-center gap-2 rounded-md font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Avatar size="sm">
              {avatars[row.userId] ? <AvatarImage src={avatars[row.userId] ?? undefined} alt="" /> : null}
              <AvatarFallback>{initials(row.fullName)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{row.fullName}</span>
          </Link>
          <Values bucket={row.total} />
          <details className="group border-t">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-medium text-muted-foreground">
              {f.shortRange(weeks[0].start, weeks[weeks.length - 1].end)}
              <ChevronDown aria-hidden className="size-4 group-open:rotate-180" />
            </summary>
            <ul className="flex flex-col gap-3">
              {row.weeks.map((bucket, i) => (
                <li key={weeks[i].weekIndex} className="flex flex-col gap-1">
                  <p className="text-xs font-medium">
                    {t("week", { n: weeks[i].weekIndex })}{" "}
                    <span className="tabular font-normal text-muted-foreground">{f.shortRange(weeks[i].start, weeks[i].end)}</span>
                  </p>
                  <Values bucket={bucket} />
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
      <li className="flex flex-col gap-3 rounded-lg border bg-card p-3">
        <p className="font-semibold">{t("teamTotal")}</p>
        <Values bucket={totals.total} />
      </li>
    </ul>
  );
}

/** Hours, Days, Vac/Sick, Holidays of one bucket, labelled like the table columns. */
function Values({ bucket }: { bucket: Bucket }) {
  const t = useTranslations("team.grid");
  const f = useFormat();
  const values = bucketValues(bucket);
  const formats = [f.hours, f.days, f.count, f.count];
  return (
    <dl className="grid grid-cols-4 gap-2">
      {SUB_COLUMNS.map((sub, s) => (
        <div key={sub} className="flex min-w-0 flex-col justify-between">
          <dt className="text-xs text-muted-foreground">{t(`sub.${sub}`)}</dt>
          <dd className={cn("tabular font-semibold", values[s] === 0 && "text-muted-foreground", s === 2 && values[s] > 0 && "text-pto", s === 3 && values[s] > 0 && "text-holiday")}>
            {orDot(values[s], formats[s])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
