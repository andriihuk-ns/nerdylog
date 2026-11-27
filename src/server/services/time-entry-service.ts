import {
  entryTypeSchema,
  extractTicketRefs,
  timeEntryInputSchema,
  type CreateTimeEntry,
  type DeleteTimeEntry,
  type EntryType,
  type ListWeekEntries,
  type SetDayStatus,
  type UpdateTimeEntry,
} from "@/contracts";
import { getDb, type Db } from "@/server/db/client";
import {
  deleteDayEntries,
  deleteEntry,
  findEntryView,
  insertEntry,
  listEntryViews,
  updateEntry,
} from "@/server/db/queries/time-entry-views";
import type { TimeEntryInsert } from "@/server/db/schema";
import { addDays, dayOfWeek } from "./calendar";
import { NotFoundError } from "./errors";
import { assertProjectMember } from "./project-service";
import { assertCanActOnUser } from "./rbac";
import { assertIsoDate, assertRowId, parseInput } from "./validation";

const PTO_TYPES: readonly EntryType[] = ["vacation", "sick", "holiday"];

/** Contract ListWeekEntries. RangeError unless weekStart is a real Monday. */
export const listWeekEntries: ListWeekEntries = async (actor, userId, weekStart) => {
  assertIsoDate(weekStart, "weekStart");
  if (dayOfWeek(weekStart) !== 1) throw new RangeError(`weekStart must be a Monday: ${weekStart}`);
  assertCanActOnUser(actor, userId);
  return listEntryViews(getDb(), userId, weekStart, addDays(weekStart, 6));
};

/**
 * Contract CreateTimeEntry. Validates with timeEntryInputSchema, source `web_ui`.
 * A15: the entry's owner (not the actor) must be a member of the project.
 */
export const createTimeEntry: CreateTimeEntry = async (actor, input) => {
  const parsed = parseInput(timeEntryInputSchema, { ...input, source: "web_ui", slackViewId: null });
  assertIsoDate(parsed.workDate, "workDate");
  assertCanActOnUser(actor, parsed.userId);
  if (parsed.projectId) await assertProjectMember(parsed.userId, parsed.projectId);
  const row: TimeEntryInsert = {
    userId: parsed.userId,
    projectId: parsed.projectId,
    workDate: parsed.workDate,
    hours: parsed.hours,
    entryType: parsed.entryType,
    taskSummary: parsed.taskSummary,
    ticketRefs: extractTicketRefs(parsed.taskSummary),
    source: "web_ui",
    slackViewId: null,
  };
  const db = getDb();
  const id = await insertEntry(db, row);
  return mustFind(db, id);
};

/**
 * Contract UpdateTimeEntry. The merged row is re-validated as a whole (so a work row
 * cannot lose its project and PTO rows stay at 0h). `source` keeps the row's origin.
 * A15: moving the row to another project requires the owner to be a member of it; rows that keep
 * their project stay editable even if the owner has since left the channel.
 */
export const updateTimeEntry: UpdateTimeEntry = async (actor, id, patch) => {
  assertRowId(id, "Time entry");
  const db = getDb();
  const existing = await findEntryView(db, id);
  if (!existing) throw new NotFoundError("Time entry not found");
  assertCanActOnUser(actor, existing.userId);
  const merged = parseInput(timeEntryInputSchema, {
    userId: existing.userId,
    projectId: patch.projectId !== undefined ? patch.projectId : existing.projectId,
    workDate: existing.workDate,
    hours: patch.hours ?? existing.hours,
    entryType: existing.entryType,
    taskSummary: patch.taskSummary ?? existing.taskSummary,
    source: existing.source,
    slackViewId: null,
  });
  if (merged.projectId && merged.projectId !== existing.projectId) {
    await assertProjectMember(existing.userId, merged.projectId);
  }
  await updateEntry(db, id, {
    projectId: merged.projectId,
    hours: merged.hours,
    taskSummary: merged.taskSummary,
    ticketRefs: extractTicketRefs(merged.taskSummary),
  });
  return mustFind(db, id);
};

/** Contract DeleteTimeEntry. */
export const deleteTimeEntry: DeleteTimeEntry = async (actor, id) => {
  assertRowId(id, "Time entry");
  const db = getDb();
  const existing = await findEntryView(db, id);
  if (!existing) throw new NotFoundError("Time entry not found");
  assertCanActOnUser(actor, existing.userId);
  await deleteEntry(db, id);
};

/**
 * Contract SetDayStatus (FR-WEB-02), one transaction:
 * "work" → delete that day's PTO rows (work rows stay);
 * vacation/sick/holiday → delete every row of that day, then insert one 0h PTO row.
 * Returns the day's rows after the change.
 */
export const setDayStatus: SetDayStatus = async (actor, userId, date, status) => {
  assertIsoDate(date);
  const entryType = parseInput(entryTypeSchema, status);
  assertCanActOnUser(actor, userId);
  return getDb().transaction(async (tx) => {
    if (entryType === "work") {
      await deleteDayEntries(tx, userId, date, PTO_TYPES);
    } else {
      await deleteDayEntries(tx, userId, date);
      await insertEntry(tx, {
        userId,
        projectId: null,
        workDate: date,
        hours: 0,
        entryType,
        taskSummary: "",
        ticketRefs: [],
        source: "web_ui",
        slackViewId: null,
      });
    }
    return listEntryViews(tx, userId, date, date);
  });
};

async function mustFind(db: Db, id: string) {
  const view = await findEntryView(db, id);
  if (!view) throw new NotFoundError("Time entry not found");
  return view;
}
