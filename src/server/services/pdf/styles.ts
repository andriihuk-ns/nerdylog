import { StyleSheet } from "@react-pdf/renderer";
import "./fonts";

/**
 * Print styles for the FR-EXP-02 report: neutral ink on white, hairline rules,
 * right-aligned numbers. Embedded Noto Sans supports Cyrillic report text.
 */
export const colors = {
  ink: "#111113",
  muted: "#6B6B70",
  hairline: "#D9D9DE",
  band: "#F4F4F5",
  coral: "#C2410C",
};

export const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, color: colors.ink, fontFamily: "NotoSans" },
  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 8 },
  brand: { fontSize: 8, color: colors.muted, letterSpacing: 1 },
  title: { fontSize: 18, fontFamily: "NotoSans-Bold", marginTop: 2 },
  meta: { fontSize: 9, color: colors.muted, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontFamily: "NotoSans-Bold", marginTop: 14, marginBottom: 6 },
  subTitle: { fontSize: 9, fontFamily: "NotoSans-Bold", marginTop: 8, marginBottom: 4, color: colors.muted },
  table: { borderTopWidth: 0.5, borderTopColor: colors.hairline },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.hairline, paddingVertical: 3 },
  headRow: { flexDirection: "row", backgroundColor: colors.band, paddingVertical: 3 },
  headCell: { fontFamily: "NotoSans-Bold", fontSize: 8, color: colors.muted },
  num: { textAlign: "right" },
  coral: { color: colors.coral },
  empty: { color: colors.muted, marginTop: 6 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: colors.muted, flexDirection: "row", justifyContent: "space-between" },
});

/** Column widths (percent strings keep rows aligned across tables). */
export const entryCols = { date: "12%", project: "18%", type: "9%", hours: "8%", tasks: "40%", tickets: "13%" } as const;
export const totalsCols = { label: "28%", hours: "18%", days: "18%", vacSick: "18%", holidays: "18%" } as const;
