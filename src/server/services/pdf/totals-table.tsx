import { Text, View } from "@react-pdf/renderer";
import type { RollupTotals } from "@/contracts";
import { daysLabel, hoursLabel } from "./format";
import { styles, totalsCols } from "./styles";

export interface TotalsLine extends RollupTotals {
  label: string;
  bold?: boolean;
}

/** Monthly totals table: Hours, Days, Vac/Sick, Holidays (same metrics as /team). */
export function TotalsTable({ lines }: { lines: readonly TotalsLine[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.headRow} fixed>
        <Text style={[styles.headCell, { width: totalsCols.label }]}>Period</Text>
        <Text style={[styles.headCell, styles.num, { width: totalsCols.hours }]}>Hours</Text>
        <Text style={[styles.headCell, styles.num, { width: totalsCols.days }]}>Days</Text>
        <Text style={[styles.headCell, styles.num, { width: totalsCols.vacSick }]}>Vac/Sick</Text>
        <Text style={[styles.headCell, styles.num, { width: totalsCols.holidays }]}>Holidays</Text>
      </View>
      {lines.map((l) => {
        const weight = l.bold ? { fontFamily: "Helvetica-Bold" } : {};
        return (
          <View key={l.label} style={styles.row} wrap={false}>
            <Text style={[{ width: totalsCols.label }, weight]}>{l.label}</Text>
            <Text style={[styles.num, { width: totalsCols.hours }, weight]}>{hoursLabel(l.hours)}</Text>
            <Text style={[styles.num, { width: totalsCols.days }, weight]}>{daysLabel(l.days)}</Text>
            <Text style={[styles.num, { width: totalsCols.vacSick }, weight, l.vacSick > 0 ? styles.coral : {}]}>
              {l.vacSick}
            </Text>
            <Text style={[styles.num, { width: totalsCols.holidays }, weight]}>{l.holidays}</Text>
          </View>
        );
      })}
    </View>
  );
}
