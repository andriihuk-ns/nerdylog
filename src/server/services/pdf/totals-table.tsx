import { Text, View } from "@react-pdf/renderer";
import type { RollupTotals } from "@/contracts";
import { daysLabel, hoursLabel } from "./format";
import { styles, totalsCols } from "./styles";

export interface TotalsLine extends RollupTotals {
  label: string;
  bold?: boolean;
}

/** Monthly totals table: Hours, Days, Vac/Sick, Holidays (same metrics as /team). */
export function TotalsTable({ lines, projectScoped }: { lines: readonly TotalsLine[]; projectScoped: boolean }) {
  const columns = projectScoped
    ? { label: "50%", hours: "25%", days: "25%" }
    : totalsCols;
  return (
    <View style={styles.table}>
      <View style={styles.headRow} fixed>
        <Text style={[styles.headCell, { width: columns.label }]}>Period</Text>
        <Text style={[styles.headCell, styles.num, { width: columns.hours }]}>Hours</Text>
        <Text style={[styles.headCell, styles.num, { width: columns.days }]}>Days</Text>
        {!projectScoped ? <Text style={[styles.headCell, styles.num, { width: totalsCols.vacSick }]}>Vac/Sick</Text> : null}
        {!projectScoped ? <Text style={[styles.headCell, styles.num, { width: totalsCols.holidays }]}>Holidays</Text> : null}
      </View>
      {lines.map((l) => {
        const weight = l.bold ? { fontFamily: "Helvetica-Bold" } : {};
        return (
          <View key={l.label} style={styles.row} wrap={false}>
            <Text style={[{ width: columns.label }, weight]}>{l.label}</Text>
            <Text style={[styles.num, { width: columns.hours }, weight]}>{hoursLabel(l.hours)}</Text>
            <Text style={[styles.num, { width: columns.days }, weight]}>{daysLabel(l.days)}</Text>
            {!projectScoped ? (
              <Text style={[styles.num, { width: totalsCols.vacSick }, weight, l.vacSick > 0 ? styles.coral : {}]}>
                {l.vacSick}
              </Text>
            ) : null}
            {!projectScoped ? <Text style={[styles.num, { width: totalsCols.holidays }, weight]}>{l.holidays}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
