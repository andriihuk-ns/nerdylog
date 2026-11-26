import type { BuildLedgerCsv, BuildReportPdf, BuildSummaryCsv, IsoDate } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listLedgerRows, listProjectNames } from "@/server/db/queries/ledger";
import { monthRange } from "./calendar";
import { CSV_CONTENT_TYPE, encodeCsv } from "./csv";
import { resolveExportRange } from "./export-scope";
import { buildLedgerRows, buildSummaryRows } from "./ledger-csv";
import { buildReportModel } from "./pdf/report-model";
import { renderReportPdf } from "./pdf/render";
import { getTeamMonthRollup } from "./rollup-service";

/**
 * FR-EXPORT. Every export reads Stream A (`time_entries`) only; check-ins are never exported.
 * RBAC lives in resolveExportRange (ledger/PDF) and getTeamMonthRollup (summary).
 */

function todayUtc(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

/** Contract BuildLedgerCsv: Detailed Ledger CSV (UTF-8 BOM, RFC 4180, CRLF). */
export const buildLedgerCsv: BuildLedgerCsv = async (actor, range) => {
  const scope = resolveExportRange(actor, range);
  const rows = await listLedgerRows(getDb(), {
    start: scope.from,
    end: scope.to,
    users: scope.users,
    projectIds: scope.projectIds,
  });
  return {
    filename: `tempo-ledger_${scope.from}_${scope.to}.csv`,
    contentType: CSV_CONTENT_TYPE,
    body: encodeCsv(buildLedgerRows(rows)),
  };
};

/**
 * Contract BuildSummaryCsv: Monthly Summary Pivot for "YYYY-MM" (RangeError otherwise).
 * Same rows as /team: member → own row; manager/admin → every active user.
 */
export const buildSummaryCsv: BuildSummaryCsv = async (actor, month) => {
  monthRange(month);
  const rollups = await getTeamMonthRollup(actor, month);
  return {
    filename: `tempo-summary_${month}.csv`,
    contentType: CSV_CONTENT_TYPE,
    body: encodeCsv(buildSummaryRows(month, rollups)),
  };
};

/** Contract BuildReportPdf: print-grade report via @react-pdf/renderer. */
export const buildReportPdf: BuildReportPdf = async (actor, range) => {
  const scope = resolveExportRange(actor, range);
  const db = getDb();
  const rows = await listLedgerRows(db, {
    start: scope.from,
    end: scope.to,
    users: scope.users,
    projectIds: scope.projectIds,
  });
  const projectNames = scope.projectIds ? await listProjectNames(db, scope.projectIds) : [];
  const model = buildReportModel(rows, { from: scope.from, to: scope.to, generatedOn: todayUtc(), projectNames });
  return {
    filename: `tempo-report_${scope.from}_${scope.to}.pdf`,
    contentType: "application/pdf",
    body: await renderReportPdf(model),
  };
};
