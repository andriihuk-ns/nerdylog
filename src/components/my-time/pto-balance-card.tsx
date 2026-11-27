import { useTranslations } from "next-intl";
import type { PtoBalance } from "@/contracts";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";

/** Annual balances for vacation and sick leave; each allowance is tracked independently. */
export function PtoBalanceCard({ balance }: { balance: PtoBalance }) {
  const { allowanceDays, remainingDays, vacationUsedDays, sickAllowanceDays, sickRemainingDays, sickUsedDays, year } = balance;
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
      <dl className="grid grid-cols-2 gap-4 border-t pt-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">{t("vacationBalance")}</dt>
          <dd>
            {remainingDays !== null && allowanceDays !== null ? (
              <BalanceValue remaining={remainingDays} allowance={allowanceDays} label="left" />
            ) : <span className="text-sm text-muted-foreground">{t("noAllowance")}</span>}
            <span className="mt-1 block text-xs text-muted-foreground">{t("used", { count: vacationUsedDays, value: f.count(vacationUsedDays) })}</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">{t("sickDays")}</dt>
          <dd>
            {sickRemainingDays !== null && sickAllowanceDays !== null ? (
              <BalanceValue remaining={sickRemainingDays} allowance={sickAllowanceDays} label="sickLeft" />
            ) : <span className="text-sm text-muted-foreground">{t("noSickAllowance")}</span>}
            <span className="mt-1 block text-xs text-muted-foreground">{t("used", { count: sickUsedDays, value: f.count(sickUsedDays) })}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function BalanceValue({ remaining, allowance, label }: { remaining: number; allowance: number; label: "left" | "sickLeft" }) {
  const t = useTranslations("pto");
  const f = useFormat();
  return (
    <>
      <data value={remaining} className={cn("tabular block text-2xl font-semibold", remaining < 0 && "text-pto")}>
        {f.count(remaining)}
      </data>
      <span className="text-xs text-muted-foreground">
        {t.rich(label, {
          remaining,
          allowance: f.count(allowance),
          n: (chunks) => <span className="tabular">{chunks}</span>,
        })}
      </span>
    </>
  );
}
