import { Text, View } from "@react-pdf/renderer";
import { entryTypeLabel, hoursLabel } from "./format";
import type { ReportEntry } from "./report-model";
import { entryCols, styles } from "./styles";

/** Per-entry breakdown with task descriptions and ticket ids. Header repeats on page breaks. */
export function EntriesTable({ entries }: { entries: readonly ReportEntry[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.headRow} fixed>
        <Text style={[styles.headCell, { width: entryCols.date }]}>Date</Text>
        <Text style={[styles.headCell, { width: entryCols.project }]}>Project</Text>
        <Text style={[styles.headCell, { width: entryCols.type }]}>Type</Text>
        <Text style={[styles.headCell, styles.num, { width: entryCols.hours, paddingRight: 6 }]}>Hours</Text>
        <Text style={[styles.headCell, { width: entryCols.tasks }]}>Tasks</Text>
        <Text style={[styles.headCell, { width: entryCols.tickets }]}>Tickets</Text>
      </View>
      {entries.map((e, i) => (
        <View key={`${e.date}-${i}`} style={styles.row} wrap={false}>
          <Text style={{ width: entryCols.date }}>{e.date}</Text>
          <Text style={{ width: entryCols.project }}>{e.project || "—"}</Text>
          <Text style={[{ width: entryCols.type }, e.entryType === "work" ? {} : styles.coral]}>
            {entryTypeLabel(e.entryType)}
          </Text>
          <Text style={[styles.num, { width: entryCols.hours, paddingRight: 6 }]}>{hoursLabel(e.hours)}</Text>
          <Text style={{ width: entryCols.tasks }}>{e.tasks}</Text>
          <Text style={{ width: entryCols.tickets }}>{e.tickets}</Text>
        </View>
      ))}
    </View>
  );
}
