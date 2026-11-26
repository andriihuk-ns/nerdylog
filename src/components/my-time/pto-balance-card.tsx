import { useTranslations } from "next-intl";
import type { PtoBalance } from "@/contracts";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";

/** Amendment A9: remaining vacation = allowance − vacation days used. Sick days never reduce it. */
export function PtoBalanceCard({ balance }: { balance: PtoBalance }) {
  const { allowanceDays, remainingDays, vacationUsedDays, sickUsedDays, year } = balance;
  const t = useTranslations("pto");
  const f = useFormat();
  return (
    <section aria-labelledby="pto-title" className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="pto-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <span className="tabular text-xs font-medium text-muted-foreground">{year}</span>
      </div>
      {remainingDays !== null && allowanceDays !== null ? (
        <p>
          <data
            value={remainingDays}
            className={cn("tabular block text-2xl font-semibold", remainingDays < 0 && "text-pto")}
          >
            {f.count(remainingDays)}
          </data>
          <span className="text-muted-foreground">
            {t.rich("left", {
              remaining: remainingDays,
              allowance: f.count(allowanceDays),
              n: (chunks) => <span className="tabular">{chunks}</span>,
            })}
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground">{t("noAllowance")}</p>
      )}
      <dl className="grid grid-cols-2 gap-4 border-t pt-4">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{t("vacationUsed")}</dt>
          <dd className="tabular font-medium">{t("days", { count: vacationUsedDays, value: f.count(vacationUsedDays) })}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{t("sickDays")}</dt>
          <dd className="tabular font-medium">{t("days", { count: sickUsedDays, value: f.count(sickUsedDays) })}</dd>
        </div>
      </dl>
    </section>
  );
}
