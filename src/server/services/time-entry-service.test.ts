import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TimeEntryView } from "@/contracts";

const tx = { tx: true };
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ transaction: (fn: (t: unknown) => unknown) => fn(tx) }),
}));
vi.mock("@/server/db/queries/time-entry-views", () => ({
  listEntryViews: vi.fn(),
  findEntryView: vi.fn(),
  insertEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  deleteDayEntries: vi.fn(),
}));

import * as q from "@/server/db/queries/time-entry-views";
import { ForbiddenError, InvalidInputError, NotFoundError } from "./errors";
import { createTimeEntry, deleteTimeEntry, listWeekEntries, setDayStatus, updateTimeEntry } from "./time-entry-service";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const ENTRY = "44444444-4444-4444-8444-444444444444";
const member = { userId: ME, role: "member" as const };
const manager = { userId: ME, role: "manager" as const };

const view = (over: Partial<TimeEntryView> = {}): TimeEntryView => ({
  id: ENTRY,
  userId: OTHER,
  projectId: PROJECT,
  projectName: "DogTeamPro",
  workDate: "2026-11-27",
  hours: 4,
  entryType: "work",
  taskSummary: "Old",
  ticketRefs: [],
  source: "slack_standup",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(q.listEntryViews).mockResolvedValue([]);
  vi.mocked(q.insertEntry).mockResolvedValue(ENTRY);
  vi.mocked(q.findEntryView).mockResolvedValue(view());
});

describe("listWeekEntries", () => {
  it("requires a Monday and reads Mon–Sun", async () => {
    await expect(listWeekEntries(member, ME, "2026-11-25")).rejects.toBeInstanceOf(RangeError);
    await expect(listWeekEntries(member, ME, "2026-13-01")).rejects.toBeInstanceOf(RangeError);
    await listWeekEntries(member, ME, "2026-11-23");
    expect(q.listEntryViews).toHaveBeenCalledWith(expect.anything(), ME, "2026-11-23", "2026-11-29");
  });

  it("forbids members reading others; managers may", async () => {
    await expect(listWeekEntries(member, OTHER, "2026-11-23")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listWeekEntries(manager, OTHER, "2026-11-23")).resolves.toEqual([]);
  });
});

describe("createTimeEntry", () => {
  const input = { userId: ME, projectId: PROJECT, workDate: "2026-11-27", hours: 2.5, entryType: "work" as const, taskSummary: "Fix DOG-1364 and CNG-009" };

  it("writes source web_ui and extracted ticket refs", async () => {
    await createTimeEntry(member, input);
    expect(q.insertEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: "web_ui", slackViewId: null, ticketRefs: ["DOG-1364", "CNG-009"], hours: 2.5 }),
    );
  });

  it("rejects invalid input with field errors and writes nothing", async () => {
    const err = await createTimeEntry(member, { ...input, projectId: null }).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(err.fieldErrors).toHaveProperty("projectId");
    await expect(createTimeEntry(member, { ...input, hours: 2.3 })).rejects.toBeInstanceOf(InvalidInputError);
    expect(q.insertEntry).not.toHaveBeenCalled();
  });

  it("lets a member create only for themselves; a manager for anyone", async () => {
    await expect(createTimeEntry(member, { ...input, userId: OTHER })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createTimeEntry(manager, { ...input, userId: OTHER })).resolves.toBeDefined();
  });
});

describe("updateTimeEntry / deleteTimeEntry", () => {
  it("member cannot touch another user's row; manager can", async () => {
    await expect(updateTimeEntry(member, ENTRY, { hours: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteTimeEntry(member, ENTRY)).rejects.toBeInstanceOf(ForbiddenError);
    expect(q.updateEntry).not.toHaveBeenCalled();
    expect(q.deleteEntry).not.toHaveBeenCalled();
    await deleteTimeEntry(manager, ENTRY);
    expect(q.deleteEntry).toHaveBeenCalledWith(expect.anything(), ENTRY);
  });

  it("re-validates the merged row and re-extracts tickets", async () => {
    await updateTimeEntry(manager, ENTRY, { taskSummary: "Now DOG-7" });
    expect(q.updateEntry).toHaveBeenCalledWith(expect.anything(), ENTRY, {
      projectId: PROJECT,
      hours: 4,
      taskSummary: "Now DOG-7",
      ticketRefs: ["DOG-7"],
    });
    await expect(updateTimeEntry(manager, ENTRY, { projectId: null })).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("keeps PTO rows at 0h", async () => {
    vi.mocked(q.findEntryView).mockResolvedValue(view({ entryType: "sick", hours: 0, projectId: null }));
    await expect(updateTimeEntry(manager, ENTRY, { hours: 8 })).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    vi.mocked(q.findEntryView).mockResolvedValue(undefined);
    await expect(deleteTimeEntry(manager, ENTRY)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateTimeEntry(manager, "nope", { hours: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("setDayStatus", () => {
  it("work → deletes only PTO rows inside the transaction", async () => {
    await setDayStatus(member, ME, "2026-11-27", "work");
    expect(q.deleteDayEntries).toHaveBeenCalledWith(tx, ME, "2026-11-27", ["vacation", "sick", "holiday"]);
    expect(q.insertEntry).not.toHaveBeenCalled();
    expect(q.listEntryViews).toHaveBeenCalledWith(tx, ME, "2026-11-27", "2026-11-27");
  });

  it("PTO → clears the day and writes one 0h row", async () => {
    await setDayStatus(manager, OTHER, "2026-11-27", "vacation");
    expect(q.deleteDayEntries).toHaveBeenCalledWith(tx, OTHER, "2026-11-27");
    expect(q.insertEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userId: OTHER, entryType: "vacation", hours: 0, projectId: null, source: "web_ui" }),
    );
  });

  it("enforces RBAC and validates status/date", async () => {
    await expect(setDayStatus(member, OTHER, "2026-11-27", "sick")).rejects.toBeInstanceOf(ForbiddenError);
    // @ts-expect-error invalid status on purpose
    await expect(setDayStatus(member, ME, "2026-11-27", "party")).rejects.toBeInstanceOf(InvalidInputError);
    await expect(setDayStatus(member, ME, "2026-02-30", "sick")).rejects.toBeInstanceOf(RangeError);
    expect(q.deleteDayEntries).not.toHaveBeenCalled();
  });
});
