import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EmployeeSection } from "./employee-section";
import { daysLabel, hoursLabel } from "./format";
import type { ReportModel } from "./report-model";
import { styles } from "./styles";

/** FR-EXP-02 report: header, date range, overall totals, then one section per employee. */
export function ReportDocument({ model }: { model: ReportModel }) {
  return (
    <Document title={`NerdyLog ${model.title} ${model.from} – ${model.to}`} author="NerdyLog" creator="NerdyLog">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>NERDYLOG</Text>
          <Text style={styles.title}>{model.title}</Text>
          <Text style={styles.meta}>Client / scope: {model.scope}</Text>
          {model.projectScoped ? (
            <Text style={styles.meta}>PTO and holidays are shown as context, not project work.</Text>
          ) : null}
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
          model.employees.map((e, i) => (
            <EmployeeSection key={e.userId} employee={e} breakBefore={i > 0} projectScoped={model.projectScoped} />
          ))
        )}

        <View style={styles.footer} fixed>
          <Text>
            NerdyLog · {model.from} – {model.to}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
