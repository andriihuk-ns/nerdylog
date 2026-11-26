import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EmployeeSection } from "./employee-section";
import { daysLabel, hoursLabel } from "./format";
import type { ReportModel } from "./report-model";
import { styles } from "./styles";

/** FR-EXP-02 report: header, date range, overall totals, then one section per employee. */
export function ReportDocument({ model }: { model: ReportModel }) {
  return (
    <Document title={`nerdylog ${model.title} ${model.from} – ${model.to}`} author="nerdylog" creator="nerdylog">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>TEMPO</Text>
          <Text style={styles.title}>{model.title}</Text>
          <Text style={styles.meta}>Client / scope: {model.scope}</Text>
          <Text style={styles.meta}>
            Period {model.from} – {model.to} · Generated {model.generatedOn}
          </Text>
          <Text style={styles.meta}>
            {model.employees.length} {model.employees.length === 1 ? "employee" : "employees"} · {hoursLabel(model.totalHours)}{" "}
            hours · {daysLabel(model.totalDays)} day-equivalents
          </Text>
        </View>

        {model.employees.length === 0 ? (
          <Text style={styles.empty}>No time entries in this period.</Text>
        ) : (
          model.employees.map((e, i) => <EmployeeSection key={e.userId} employee={e} breakBefore={i > 0} />)
        )}

        <View style={styles.footer} fixed>
          <Text>
            nerdylog · {model.from} – {model.to}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
