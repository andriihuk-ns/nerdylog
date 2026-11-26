import type { PtoBalance } from "@/contracts";
import { cn } from "@/lib/utils";
import { formatCount } from "@/components/lib/format";

/** Amendment A9: remaining vacation = allowance − vacation days used. Sick days never reduce it. */
export function PtoBalanceCard({ balance }: { balance: PtoBalance }) {
  const { allowanceDays, remainingDays, vacationUsedDays, sickUsedDays, year } = balance;
  return (
    <section aria-labelledby="pto-title" className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="pto-title" className="text-lg font-semibold">
          Time off
        </h2>
        <span className="tabular text-xs font-medium text-muted-foreground">{year}</span>
      </div>
      {remainingDays !== null && allowanceDays !== null ? (
        <p>
          <data
            value={remainingDays}
            className={cn("tabular block text-2xl font-semibold", remainingDays < 0 && "text-pto")}
          >
            {formatCount(remainingDays)}
          </data>
          <span className="text-muted-foreground">
            vacation days left of <span className="tabular">{formatCount(allowanceDays)}</span>
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground">No vacation allowance set. Ask an admin to add one.</p>
      )}
      <dl className="grid grid-cols-2 gap-4 border-t pt-4">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Vacation used</dt>
          <dd className="tabular font-medium">{formatCount(vacationUsedDays)} days</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Sick days</dt>
          <dd className="tabular font-medium">{formatCount(sickUsedDays)} days</dd>
        </div>
      </dl>
    </section>
  );
}
