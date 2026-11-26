import { describe, expect, it } from "vitest";
import type { UserMonthRollup } from "@/contracts";
import type { LedgerRow } from "@/server/db/queries/ledger";
import { csvCell, encodeCsv, formatNumber, safeText, toCsv, UTF8_BOM } from "./csv";
import { buildLedgerRows, buildSummaryRows, dayEquivalent, LEDGER_HEADER } from "./ledger-csv";
import { aggregateMonth } from "./time-aggregator";

const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  workDate: "2026-11-02",
  userId: "u1",
  fullName: "Sviatoslav",
  dailyNormHours: 8,
  projectId: "p1",
  projectName: "DogTeamPro",
  entryType: "work",
  hours: 4,
  taskSummary: "Map modal iterations DOG-1364",
  ticketRefs: ["DOG-1364"],
  source: "slack_standup",
  ...over,
});

const decode = (bytes: Uint8Array) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

describe("csv encoding (RFC 4180)", () => {
  it("starts with a UTF-8 BOM (EF BB BF) and ends lines with CRLF", () => {
    const bytes = encodeCsv([["a", "b"], ["c", "d"]]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(decode(bytes)).toBe(`${UTF8_BOM}a,b\r\nc,d\r\n`);
  });

  it("quotes commas, quotes and newlines; doubles inner quotes", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("cr\rlf")).toBe('"cr\rlf"');
    expect(csvCell(2.5)).toBe("2.5");
  });

  it("keeps Cyrillic text intact in UTF-8", () => {
    expect(decode(encodeCsv([["Святослав"]]))).toBe(`${UTF8_BOM}Святослав\r\n`);
  });

  it("neutralises formula-like free text", () => {
    expect(safeText("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeText("@SUM")).toBe("'@SUM");
    expect(safeText("Normal note")).toBe("Normal note");
  });

  it("formats numbers without locale or float noise", () => {
    expect(formatNumber(0.1 + 0.2, 2)).toBe("0.3");
    expect(formatNumber(4, 2)).toBe("4");
    expect(formatNumber(-0.0001, 2)).toBe("0");
  });
});

describe("buildLedgerRows", () => {
  it("emits the exact FR-EXP-01 header", () => {
    expect(toCsv([[...LEDGER_HEADER]])).toBe(
      "Date,ISO_Week,Employee,Project,Entry_Type,Hours,Day_Equiv,Tasks,Ticket_IDs,Source\r\n",
    );
    expect(buildLedgerRows([])[0]).toEqual([...LEDGER_HEADER]);
  });

  it("maps one entry per line with ISO week and Day_Equiv = hours / norm", () => {
    const [, line] = buildLedgerRows([row()]);
    expect(line).toEqual([
      "2026-11-02",
      45,
      "Sviatoslav",
      "DogTeamPro",
      "work",
      "4",
      "0.5",
      "Map modal iterations DOG-1364",
      "DOG-1364",
      "slack_standup",
    ]);
  });

  it("uses the user's custom norm and falls back to 8h for a bad norm", () => {
    expect(buildLedgerRows([row({ hours: 2.5, dailyNormHours: 6 })])[1][6]).toBe("0.4167");
    expect(dayEquivalent(4, 0)).toBe(0.5);
  });

  it("writes PTO rows with an empty project and 0 day-equivalents", () => {
    const [, line] = buildLedgerRows([
      row({ entryType: "vacation", hours: 0, projectId: null, projectName: null, taskSummary: "", ticketRefs: [] }),
    ]);
    expect(line.slice(3, 9)).toEqual(["", "vacation", "0", "0", "", ""]);
  });

  it("quotes task text with commas, quotes and newlines in the final CSV", () => {
    const rows = buildLedgerRows([
      row({ taskSummary: 'Fix "login", then\ndeploy', ticketRefs: ["DOG-1", "CNG-009"] }),
    ]);
    const csv = toCsv(rows);
    expect(csv).toContain('"Fix ""login"", then\ndeploy"');
    expect(csv).toContain(",DOG-1; CNG-009,");
    expect(csv.endsWith("slack_standup\r\n")).toBe(true);
  });
});

describe("buildSummaryRows", () => {
  const rollups: UserMonthRollup[] = aggregateMonth(
    "2026-11",
    [{ id: "u1", fullName: "Sviatoslav", dailyNormHours: 8 }],
    [
      { userId: "u1", workDate: "2026-11-02", hours: 8, entryType: "work", projectId: "p1" },
      { userId: "u1", workDate: "2026-11-03", hours: 0, entryType: "sick", projectId: null },
      { userId: "u1", workDate: "2026-11-30", hours: 4, entryType: "work", projectId: "p1" },
    ],
  );

  it("has one header group per month-week (A2) plus the month total", () => {
    const [header] = buildSummaryRows("2026-11", rollups);
    expect(header.slice(0, 6)).toEqual([
      "Employee",
      "Daily_Norm_Hours",
      "Week 1 (11-01..11-01) Hours",
      "Week 1 (11-01..11-01) Days",
      "Week 1 (11-01..11-01) Vac/Sick",
      "Week 1 (11-01..11-01) Holidays",
    ]);
    expect(header).toHaveLength(2 + 6 * 4 + 4); // Nov 2026 has 6 month-weeks
    expect(header.at(-4)).toBe("2026-11 Total Hours");
  });

  it("fills Hours, Days, Vac/Sick, Holidays per week and the total", () => {
    const [, line] = buildSummaryRows("2026-11", rollups);
    expect(line.slice(0, 2)).toEqual(["Sviatoslav", "8"]);
    expect(line.slice(6, 10)).toEqual(["8", "1", 1, 0]); // week 2: Nov 2–8
    expect(line.slice(-4)).toEqual(["12", "1.5", 1, 0]);
  });

  it("still writes the header when there are no users", () => {
    expect(buildSummaryRows("2026-02", [])).toHaveLength(1);
  });
});
