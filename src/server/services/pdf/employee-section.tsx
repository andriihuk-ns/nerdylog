import { Text, View } from "@react-pdf/renderer";
import { EntriesTable } from "./entries-table";
import { monthLabel } from "./format";
import type { EmployeeReport } from "./report-model";
import { styles } from "./styles";
import { TotalsTable, type TotalsLine } from "./totals-table";

/** One employee: monthly totals, PTO context, then every scoped entry with its task notes. */
export function EmployeeSection({
  employee,
  breakBefore,
  projectScoped,
}: {
  employee: EmployeeReport;
  breakBefore: boolean;
  projectScoped: boolean;
}) {
  const lines: TotalsLine[] = [
    ...employee.months.map((m) => ({ ...m, label: monthLabel(m.month) })),
    ...(employee.months.length > 1 ? [{ ...employee.total, label: "Total", bold: true }] : []),
  ];
  const { vacation, sick, holiday } = employee.pto;
  return (
    <View break={breakBefore}>
      <Text style={styles.sectionTitle}>{employee.fullName || "Unnamed user"}</Text>
      <Text style={styles.meta}>Daily norm {employee.dailyNormHours.toFixed(1)}h</Text>

      <Text style={styles.subTitle}>Monthly totals</Text>
      <TotalsTable lines={lines} projectScoped={projectScoped} />

      <Text style={styles.subTitle}>PTO summary{projectScoped ? " · context only" : ""}</Text>
      <Text>
        Vacation {vacation} {vacation === 1 ? "day" : "days"} · Sick {sick} {sick === 1 ? "day" : "days"} · Holidays{" "}
        {holiday} {holiday === 1 ? "day" : "days"}
      </Text>

      <Text style={styles.subTitle}>Entries</Text>
      <EntriesTable entries={employee.entries} />
    </View>
  );
}
