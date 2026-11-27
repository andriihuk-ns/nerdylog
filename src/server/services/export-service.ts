import type { BuildLedgerCsv, BuildReportPdf, BuildSummaryCsv, IsoDate } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listLedgerRows, listProjectNames } from "@/server/db/queries/ledger";
import { listProjectMemberRows } from "@/server/db/queries/projects";
import { listActiveRollupUsers } from "@/server/db/queries/users";
import { monthRange } from "./calendar";
import { CSV_CONTENT_TYPE, encodeCsv } from "./csv";
import { resolveExportRange, type ResolvedExportRange } from "./export-scope";
import { buildLedgerRows, buildSummaryRows } from "./ledger-csv";
import { buildReportModel } from "./pdf/report-model";
import { renderReportPdf } from "./pdf/render";
import { getTeamMonthRollup } from "./rollup-service";

/**
 * FR-EXPORT. Every export reads Stream A (`time_entries`) only; check-ins are never exported.
 * RBAC lives in resolveExportRange (all exports) and getTeamMonthRollup (summary). Project
 * exports include selected-project work plus PTO rows for its members as context.
 */

function todayUtc(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

function projectFilenameSuffix(projectIds: readonly string[] | undefined, projectNames: readonly string[]): string {
  if (!projectIds?.length) return "";
  const slug = projectNames
    .join("-")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
  const fallback = projectIds.length === 1 ? projectIds.at(0)?.slice(0, 8) ?? "project" : "projects";
  return `_${slug || fallback}`;
}

async function listExportRows(scope: ResolvedExportRange) {
  const db = getDb();
  const projectIds = scope.projectIds;
  const projectRows = await listLedgerRows(db, {
    start: scope.from,
    end: scope.to,
    users: scope.users,
    projectIds: scope.projectIds,
  });
  if (!projectIds) return projectRows;

  const activeUsers = await listActiveRollupUsers(db);
  const allowedUserIds = new Set(
    activeUsers.filter((user) => scope.users === "active" || scope.users.includes(user.id)).map((user) => user.id),
  );
  const projectMembers = await listProjectMemberRows(db, { projectIds });
  const includedUserIds = [
    ...new Set([...projectMembers.map((member) => member.userId), ...projectRows.map((row) => row.userId)]),
  ].filter((userId) => allowedUserIds.has(userId));
  const contextRows = await listLedgerRows(db, { start: scope.from, end: scope.to, users: includedUserIds });
  return contextRows.filter(
    (row) => row.entryType !== "work" || (row.projectId !== null && projectIds.includes(row.projectId)),
  );
}

/** Contract BuildLedgerCsv: Detailed Ledger CSV (UTF-8 BOM, RFC 4180, CRLF). */
export const buildLedgerCsv: BuildLedgerCsv = async (actor, range) => {
  const scope = resolveExportRange(actor, range);
  const rows = await listExportRows(scope);
  const projectNames = scope.projectIds ? await listProjectNames(getDb(), scope.projectIds) : [];
  return {
    filename: `nerdylog-ledger_${scope.from}_${scope.to}${projectFilenameSuffix(scope.projectIds, projectNames)}.csv`,
    contentType: CSV_CONTENT_TYPE,
    body: encodeCsv(buildLedgerRows(rows, Boolean(scope.projectIds?.length))),
  };
};

/**
 * Contract BuildSummaryCsv: Monthly Summary Pivot for "YYYY-MM" (RangeError otherwise).
 * Same rows as /team: member → own row; manager/admin → every active user. Project scope narrows
 * the roster and labels PTO counts as context.
 */
export const buildSummaryCsv: BuildSummaryCsv = async (actor, month, projectIds) => {
  const { start, end } = monthRange(month);
  const scope = resolveExportRange(actor, { from: start, to: end, projectIds });
  const rollups = await getTeamMonthRollup(actor, month, scope.projectIds);
  const projectNames = scope.projectIds ? await listProjectNames(getDb(), scope.projectIds) : [];
  const projectName = scope.projectIds ? projectNames.join(", ") || scope.projectIds.join(", ") : undefined;
  return {
    filename: `nerdylog-summary_${month}${projectFilenameSuffix(scope.projectIds, projectNames)}.csv`,
    contentType: CSV_CONTENT_TYPE,
    body: encodeCsv(buildSummaryRows(month, rollups, projectName)),
  };
};

/** Contract BuildReportPdf: print-grade report via @react-pdf/renderer. */
export const buildReportPdf: BuildReportPdf = async (actor, range) => {
  const scope = resolveExportRange(actor, range);
  const db = getDb();
  const rows = await listExportRows(scope);
  const projectNames = scope.projectIds ? await listProjectNames(db, scope.projectIds) : [];
  const model = buildReportModel(rows, {
    from: scope.from,
    to: scope.to,
    generatedOn: todayUtc(),
    projectNames,
    projectScoped: Boolean(scope.projectIds?.length),
  });
  return {
    filename: `nerdylog-report_${scope.from}_${scope.to}${projectFilenameSuffix(scope.projectIds, projectNames)}.pdf`,
    contentType: "application/pdf",
    body: await renderReportPdf(model),
  };
};
