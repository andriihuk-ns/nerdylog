import { describe, expect, it } from "vitest";
import type { ProjectHours } from "@/contracts";
import { ACTION, BLOCK, CALLBACK, MAX_PROJECT_ROWS, rowBlock } from "../ids";
import { decodeMetadata, type ModalMetadata } from "../metadata";
import { project, ptoBalance, USER_ID } from "../testing/fake-deps";
import { buildAppHome } from "./app-home";
import { buildMorningDm } from "./morning-dm";
import { buildPtoModal } from "./pto-modal";
import { buildStandupCard } from "./standup-card";
import { buildTimeModal } from "./time-modal";

type Json = Record<string, unknown> & { [k: string]: unknown };
const json = (v: unknown): Json[] => JSON.parse(JSON.stringify(v));
const ids = (blocks: unknown[]) => json(blocks).map((b) => b.block_id).filter(Boolean);
const types = (blocks: unknown[]) => json(blocks).map((b) => b.type);

const meta = (over: Partial<ModalMetadata> = {}): ModalMetadata => ({
  kind: "standup",
  logDate: "2026-11-25",
  userId: USER_ID,
  today: "2026-11-26",
  rows: 1,
  ...over,
});

describe("buildMorningDm", () => {
  it("has the two CTAs carrying the log date", () => {
    const dm = buildMorningDm({ fullName: "Olena Petrenko", logDate: "2026-11-25", locale: "en" });
    expect(dm.text).toContain("Morning, Olena.");
    expect(dm.text).toContain("Wednesday");
    const actions = json(dm.blocks).find((b) => b.type === "actions") as { elements: Json[] };
    expect(actions.elements.map((e) => e.action_id)).toEqual([ACTION.openStandup, ACTION.openPto]);
    expect(actions.elements.map((e) => (e.text as Json).text)).toEqual([
      "Log Yesterday & Plan Today",
      "Quick PTO (Vacation / Sick)",
    ]);
    expect(actions.elements.every((e) => e.value === "2026-11-25")).toBe(true);
    expect(actions.elements[0].style).toBe("primary");
  });

  it("falls back to a generic greeting without a name", () => {
    expect(buildMorningDm({ logDate: "2026-11-20", locale: "en" }).text).toBe("Morning. Log Friday and plan today.");
  });
});

describe("buildTimeModal", () => {
  it("standup: date, one row, add button, plan and optional blockers", () => {
    const view = buildTimeModal({ meta: meta(), projects: [project], locale: "en" });
    expect(view.callback_id).toBe(CALLBACK.time);
    expect(view.title.text).toBe("Daily standup");
    expect(ids(view.blocks)).toEqual([
      BLOCK.workDate,
      rowBlock.project(1),
      rowBlock.hours(1),
      rowBlock.task(1),
      BLOCK.rowActions,
      BLOCK.plan,
      BLOCK.blockers,
    ]);
    const blocks = json(view.blocks);
    const date = blocks.find((b) => b.block_id === BLOCK.workDate)!;
    expect((date.element as Json).initial_date).toBe("2026-11-25");
    const hours = blocks.find((b) => b.block_id === rowBlock.hours(1))!;
    expect(hours.element).toMatchObject({ type: "plain_text_input" }); // A14: accepts "2.5" and "2,5"
    expect(blocks.find((b) => b.block_id === BLOCK.blockers)!.optional).toBe(true);
    expect(blocks.find((b) => b.block_id === BLOCK.plan)!.optional).toBeUndefined();
    expect(decodeMetadata(view.private_metadata)).toEqual(meta());
  });

  it("log: no standup fields, kind log in metadata", () => {
    const view = buildTimeModal({ meta: meta({ kind: "log" }), projects: [project], locale: "en" });
    expect(view.title.text).toBe("Log time");
    expect(ids(view.blocks)).not.toContain(BLOCK.plan);
    expect(decodeMetadata(view.private_metadata)?.kind).toBe("log");
  });

  it("renders N rows; at max rows only 'Remove last' remains", () => {
    const view = buildTimeModal({ meta: meta({ rows: MAX_PROJECT_ROWS }), projects: [project], locale: "en" });
    expect(ids(view.blocks)).toContain(rowBlock.project(MAX_PROJECT_ROWS));
    const actions = json(view.blocks).find((b) => b.block_id === BLOCK.rowActions) as { elements: Json[] };
    expect(actions.elements.map((e) => e.action_id)).toEqual([ACTION.removeRow]);
  });

  it("shows an empty state instead of rows when there are no projects", () => {
    const view = buildTimeModal({ meta: meta(), projects: [], locale: "en" });
    expect(ids(view.blocks)).not.toContain(rowBlock.project(1));
    expect(JSON.stringify(view.blocks)).toContain("You're not in any project channel yet. Ask an admin to add you.");
  });
});

describe("buildPtoModal", () => {
  it("has type, start and optional end with kind pto", () => {
    const view = buildPtoModal(meta({ kind: "standup" }), "en");
    expect(view.callback_id).toBe(CALLBACK.pto);
    expect(ids(view.blocks)).toEqual([BLOCK.ptoType, BLOCK.ptoStart, BLOCK.ptoEnd]);
    expect(json(view.blocks)[2].optional).toBe(true);
    expect(decodeMetadata(view.private_metadata)?.kind).toBe("pto");
  });
});

describe("buildStandupCard", () => {
  it("formats yesterday, today and blockers", () => {
    const card = buildStandupCard({
      fullName: "Olena",
      avatarUrl: "https://a/x.png",
      yesterday: [{ hours: 4, projectName: "DogTeamPro", taskSummary: "Map modal iterations" }],
      plannedToday: "Handler mobile flow",
      blockers: "",
    });
    const text = JSON.stringify(card.blocks);
    expect(text).toContain("*Yesterday*\\n4h DogTeamPro — Map modal iterations");
    expect(text).toContain("*Today*\\nHandler mobile flow");
    expect(text).toContain("No blockers");
    expect(types(card.blocks)).toEqual(["section", "section", "context"]);
  });

  it("escapes user text and flags blockers", () => {
    const card = buildStandupCard({ fullName: "A", avatarUrl: null, yesterday: [], plannedToday: "<!here>", blockers: "API down" });
    const text = JSON.stringify(card.blocks);
    expect(text).toContain("&lt;!here&gt;");
    expect(text).toContain(":warning: Blocker: API down");
    expect(text).toContain("Nothing logged");
  });
});

describe("buildAppHome", () => {
  const hours = (projectName: string, h: number): ProjectHours => ({ projectId: projectName, projectName, month: "2026-11", hours: h });
  const base = {
    appBaseUrl: "https://tempo.example",
    locale: "en" as const,
    weekHours: 32.5,
    today: null,
    projectHours: [hours("Changelly", 6), hours("DogTeamPro", 32), hours("Idle", 0)],
    pto: ptoBalance,
    nextHoliday: { holidayDate: "2026-12-25", name: "Christmas" },
    updatedLabel: "09:41",
  };

  it("shows hours, hours per project (most first), remaining PTO and the web panel link", () => {
    const home = buildAppHome(base);
    const text = JSON.stringify(home.blocks);
    expect(home.type).toBe("home");
    expect(text).toContain("32.5h");
    expect(text).toContain("Not logged");
    expect(text).toContain("This month by project");
    expect(text).toContain("*DogTeamPro*  32.0h\\n*Changelly*  6.0h");
    expect(text).not.toContain("Idle"); // zero-hour projects hidden
    expect(text).toContain("Vacation left (2026)*\\n12 days of 20");
    expect(text).toContain("https://tempo.example/my-time");
    expect(text).toContain("25 Dec"); // en-GB
  });

  it("A15: no caps anywhere (no bars, no percentages, no cap emoji)", () => {
    const text = JSON.stringify(buildAppHome(base).blocks);
    expect(text).not.toMatch(/Client caps|▰|▱|%|:red_circle:|:large_orange_circle:/);
  });

  it("shows vacation used when no allowance is set (A9) and an empty note without project hours", () => {
    const home = buildAppHome({ ...base, projectHours: [], pto: { ...ptoBalance, allowanceDays: null, remainingDays: null } });
    const text = JSON.stringify(home.blocks);
    expect(text).toContain("Vacation used (2026)*\\n8 days");
    expect(text).toContain("No hours logged this month yet.");
  });

  it("A15: has two primary buttons, Log time and Time off", () => {
    const actions = json(buildAppHome(base).blocks).find((b) => b.type === "actions") as { elements: Json[] };
    const primary = actions.elements.filter((e) => e.style === "primary");
    expect(primary.map((e) => [e.action_id, (e.text as Json).text])).toEqual([
      [ACTION.homeLog, "Log time"],
      [ACTION.homePto, "Time off"],
    ]);
  });
});
