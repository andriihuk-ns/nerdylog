import { describe, expect, it } from "vitest";
import { BLOCK, INPUT_ACTION, rowBlock } from "../ids";
import type { ModalMetadata } from "../metadata";
import { PROJECT_ID, USER_ID } from "../testing/fake-deps";
import { parsePtoSubmission } from "./pto-submission";
import type { ViewStateValues } from "./state";
import { parseTimeSubmission } from "./time-submission";

const meta = (over: Partial<ModalMetadata> = {}): ModalMetadata => ({
  kind: "standup",
  logDate: "2026-11-25",
  userId: USER_ID,
  today: "2026-11-26",
  rows: 3,
  ...over,
});

type Field = { value?: string; selected_date?: string; selected_option?: { value: string } };
const state = (fields: Record<string, Field>): ViewStateValues =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { [INPUT_ACTION]: v }]));

describe("parseTimeSubmission", () => {
  const values = (extra: Record<string, Field> = {}) =>
    state({
      [BLOCK.workDate]: { selected_date: "2026-11-25" },
      [rowBlock.project(1)]: { selected_option: { value: PROJECT_ID } },
      [rowBlock.hours(1)]: { value: "2.5" },
      [rowBlock.task(1)]: { value: "Map modal DOG-1364" },
      [BLOCK.plan]: { value: "Handler mobile flow" },
      ...extra,
    });

  it("splits Stream A rows and Stream B check-in; empty rows are ignored", () => {
    const res = parseTimeSubmission({ viewId: "V1", meta: meta(), values: values() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.kind).toBe("standup");
    expect(res.value.entries).toEqual([
      {
        userId: USER_ID,
        projectId: PROJECT_ID,
        workDate: "2026-11-25",
        hours: 2.5,
        entryType: "work",
        taskSummary: "Map modal DOG-1364",
        source: "slack_standup",
        slackViewId: "V1",
      },
    ]);
    expect(res.value.checkin).toEqual({
      userId: USER_ID,
      checkinDate: "2026-11-26",
      plannedToday: "Handler mobile flow",
      blockers: "",
    });
    expect(JSON.stringify(res.value.entries)).not.toContain("Handler mobile flow");
  });

  it("errors on a row with hours but no project, and a project without hours", () => {
    const res = parseTimeSubmission({
      viewId: "V1",
      meta: meta(),
      values: values({
        [rowBlock.hours(2)]: { value: "3" },
        [rowBlock.project(3)]: { selected_option: { value: PROJECT_ID } },
      }),
    });
    expect(res).toEqual({
      ok: false,
      errors: { [rowBlock.project(2)]: "Pick a project for this row", [rowBlock.hours(3)]: "Enter hours for this project" },
    });
  });

  it("rejects out-of-range, non-quarter and >24 total hours, and future dates", () => {
    const bad = (hours: string) =>
      parseTimeSubmission({ viewId: "V", meta: meta(), values: values({ [rowBlock.hours(1)]: { value: hours } }) });
    expect(bad("0.1")).toMatchObject({ ok: false, errors: { [rowBlock.hours(1)]: "Hours must be between 0.25 and 24" } });
    expect(bad("1.3")).toMatchObject({ ok: false, errors: { [rowBlock.hours(1)]: expect.stringContaining("quarter") } });
    const total = parseTimeSubmission({
      viewId: "V",
      meta: meta(),
      values: values({
        [rowBlock.hours(1)]: { value: "20" },
        [rowBlock.project(2)]: { selected_option: { value: PROJECT_ID } },
        [rowBlock.hours(2)]: { value: "5" },
      }),
    });
    expect(total).toMatchObject({ ok: false, errors: { [rowBlock.hours(2)]: expect.stringContaining("24") } });
    const future = parseTimeSubmission({
      viewId: "V",
      meta: meta(),
      values: values({ [BLOCK.workDate]: { selected_date: "2026-11-27" } }),
    });
    expect(future).toMatchObject({ ok: false, errors: { [BLOCK.workDate]: expect.any(String) } });
  });

  it("log kind: no check-in, slack_command source, needs at least one row", () => {
    const ok = parseTimeSubmission({ viewId: "V", meta: meta({ kind: "log" }), values: values() });
    expect(ok.ok && ok.value.checkin).toBe(null);
    expect(ok.ok && ok.value.entries[0].source).toBe("slack_command");
    const empty = parseTimeSubmission({
      viewId: "V",
      meta: meta({ kind: "log" }),
      values: state({ [BLOCK.workDate]: { selected_date: "2026-11-25" } }),
    });
    expect(empty).toMatchObject({ ok: false, errors: { [rowBlock.hours(1)]: expect.any(String) } });
  });

  it("standup with no work rows is allowed (plan only)", () => {
    const res = parseTimeSubmission({
      viewId: "V",
      meta: meta(),
      values: state({ [BLOCK.workDate]: { selected_date: "2026-11-25" }, [BLOCK.plan]: { value: "Plan" } }),
    });
    expect(res.ok && res.value.entries).toEqual([]);
  });
});

describe("parsePtoSubmission", () => {
  const pto = (start: string, end?: string, type = "vacation", holidays: string[] = []) =>
    parsePtoSubmission({
      viewId: "VP",
      meta: meta({ kind: "pto" }),
      holidays: new Set(holidays),
      values: state({
        [BLOCK.ptoType]: { selected_option: { value: type } },
        [BLOCK.ptoStart]: { selected_date: start },
        ...(end ? { [BLOCK.ptoEnd]: { selected_date: end } } : {}),
      }),
    });

  it("single date → one 0h entry", () => {
    const res = pto("2026-11-26", undefined, "sick");
    expect(res.ok && res.value.entries).toEqual([
      {
        userId: USER_ID,
        projectId: null,
        workDate: "2026-11-26",
        hours: 0,
        entryType: "sick",
        taskSummary: "",
        source: "slack_command",
        slackViewId: "VP",
      },
    ]);
    expect(res.ok && res.value.kind).toBe("pto");
  });

  it("range skips weekends and holidays", () => {
    const res = pto("2026-12-24", "2026-12-29", "vacation", ["2026-12-25"]);
    expect(res.ok && res.value.entries.map((e) => e.workDate)).toEqual(["2026-12-24", "2026-12-28", "2026-12-29"]);
  });

  it("rejects >10 business days, reversed ranges and weekend-only ranges", () => {
    expect(pto("2026-11-02", "2026-11-16")).toMatchObject({ ok: false, errors: { [BLOCK.ptoEnd]: expect.any(String) } });
    expect(pto("2026-11-02", "2026-11-13").ok).toBe(true); // exactly 10
    expect(pto("2026-11-10", "2026-11-09")).toMatchObject({ ok: false, errors: { [BLOCK.ptoEnd]: expect.any(String) } });
    expect(pto("2026-11-28", "2026-11-29")).toMatchObject({ ok: false, errors: { [BLOCK.ptoStart]: expect.any(String) } });
    expect(pto("2026-11-26", undefined, "holiday")).toMatchObject({ ok: false, errors: { [BLOCK.ptoType]: expect.any(String) } });
  });
});
