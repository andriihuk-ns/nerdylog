import { describe, expect, it } from "vitest";
import type { SlackSubmissionInput, TimeEntryInput } from "@/contracts";
import { InvalidSubmissionError, prepareSubmission } from "./standup-rows";

const USER = "7f0c1a52-8f1e-4c1b-9a35-3b1f8f0f6a01";
const OTHER = "0b4c6a52-8f1e-4c1b-9a35-3b1f8f0f6a02";
const PROJECT = "1a2b3c4d-8f1e-4c1b-9a35-3b1f8f0f6a03";

const entry = (over: Partial<TimeEntryInput> = {}): TimeEntryInput => ({
  userId: USER,
  projectId: PROJECT,
  workDate: "2026-11-25",
  hours: 2.5,
  entryType: "work",
  taskSummary: "Map modal DOG-1364, CNG-009 and DOG-1364 again",
  source: "slack_standup",
  slackViewId: null,
  ...over,
});

const input = (over: Partial<SlackSubmissionInput> = {}): SlackSubmissionInput => ({
  viewId: "V0001",
  userId: USER,
  kind: "standup",
  entries: [entry(), entry({ hours: 5.5, taskSummary: "Reviews" })],
  checkin: { userId: USER, checkinDate: "2026-11-26", plannedToday: "Ship DOG-1400", blockers: "" },
  ...over,
});

describe("prepareSubmission", () => {
  it("maps the ledger row, Stream A rows and the Stream B row separately", () => {
    const p = prepareSubmission(input());
    expect(p.submission).toEqual({ viewId: "V0001", userId: USER, kind: "standup" });
    expect(p.entries).toHaveLength(2);
    expect(p.entries[0]).toMatchObject({ hours: 2.5, ticketRefs: ["DOG-1364", "CNG-009"], slackViewId: "V0001" });
    expect(p.entries[1]).toMatchObject({ hours: 5.5, ticketRefs: [] });
    expect(p.checkin).toEqual({ userId: USER, checkinDate: "2026-11-26", plannedToday: "Ship DOG-1400", blockers: "" });
  });

  it("never copies check-in text into time entries", () => {
    const p = prepareSubmission(input());
    expect(JSON.stringify(p.entries)).not.toContain("DOG-1400");
    expect(p.entries.every((e) => !("plannedToday" in e) && !("blockers" in e))).toBe(true);
  });

  it("stamps the submission view id over any entry-supplied one", () => {
    const p = prepareSubmission(input({ entries: [entry({ slackViewId: "V-other" })] }));
    expect(p.entries[0].slackViewId).toBe("V0001");
  });

  it("accepts a PTO-only submission without a check-in", () => {
    const pto = entry({ entryType: "vacation", projectId: null, hours: 0, taskSummary: "" });
    const p = prepareSubmission(input({ kind: "pto", entries: [pto], checkin: null }));
    expect(p.entries[0]).toMatchObject({ entryType: "vacation", projectId: null, hours: 0, ticketRefs: [] });
    expect(p.checkin).toBeNull();
  });

  it("rejects entries or check-ins for another user", () => {
    expect(() => prepareSubmission(input({ entries: [entry({ userId: OTHER })] }))).toThrow(InvalidSubmissionError);
    expect(() =>
      prepareSubmission(input({ checkin: { userId: OTHER, checkinDate: "2026-11-26", plannedToday: "", blockers: "" } })),
    ).toThrow(/checkin/);
  });

  it("validates entries with timeEntryInputSchema", () => {
    expect(() => prepareSubmission(input({ entries: [entry({ projectId: null })] }))).toThrow(/entries\[0\]/);
    expect(() => prepareSubmission(input({ entries: [entry({ hours: 2.3 })] }))).toThrow(InvalidSubmissionError);
    expect(() => prepareSubmission(input({ entries: [entry({ workDate: "26.11.2026" })] }))).toThrow(InvalidSubmissionError);
  });

  it("rejects an empty view id or a bad kind", () => {
    expect(() => prepareSubmission(input({ viewId: "" }))).toThrow(/submission/);
    expect(() => prepareSubmission({ ...input(), kind: "other" as never })).toThrow(InvalidSubmissionError);
  });
});
