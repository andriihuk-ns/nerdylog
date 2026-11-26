"use server";

import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { entryTypeSchema, isoDateSchema, type EntryType, type TimeEntryView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import {
  createTimeEntry,
  deleteTimeEntry,
  listWeekEntries,
  setDayStatus,
  updateTimeEntry,
} from "@/server/services/time-entry-service";
import { mondayOf } from "@/components/lib/dates";
import { formatHours } from "@/components/lib/format";
import { actionError, fail, ok, type ActionResult } from "../action-result";
import { planCellSave } from "./cell-plan";

const saveCellSchema = z.object({
  date: isoDateSchema,
  projectId: z.uuid(),
  hours: z.number().min(0).max(24).multipleOf(0.25),
  note: z.string().max(2000).optional(),
});

export type SaveCellInput = z.input<typeof saveCellSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sets the caller's own work hours for one project on one day (web_ui source). */
export async function saveCellAction(input: SaveCellInput): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    const t = await getTranslations("myTime.server");
    const parsed = saveCellSchema.safeParse(input);
    if (!parsed.success) return fail(t("invalidHours"));
    const { date, projectId, hours, note } = parsed.data;

    const week: TimeEntryView[] = await listWeekEntries(actor, actor.userId, mondayOf(date));
    const day = week.filter((e) => e.workDate === date);
    if (day.some((e) => e.entryType !== "work")) {
      return fail(t("dayOff"));
    }
    const inCell = day.filter((e) => e.projectId === projectId);
    const otherHours = round2(day.filter((e) => e.projectId !== projectId).reduce((s, e) => s + e.hours, 0));
    if (otherHours + hours > 24) return fail(t("dayMax"));

    const plan = planCellSave(inCell, hours, note);
    if (!plan.ok) {
      const locale = await getLocale();
      return fail(t("cellBelow", { count: plan.entryCount, hours: formatHours(plan.minHours, locale) }));
    }
    for (const op of plan.ops) {
      if (op.op === "create") {
        await createTimeEntry(actor, {
          userId: actor.userId,
          projectId,
          workDate: date,
          hours: op.hours,
          entryType: "work",
          taskSummary: op.taskSummary,
        });
      } else if (op.op === "update") {
        const patch = op.taskSummary === undefined ? { hours: op.hours } : { hours: op.hours, taskSummary: op.taskSummary };
        await updateTimeEntry(actor, op.id, patch);
      } else {
        await deleteTimeEntry(actor, op.id);
      }
    }
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}

const dayStatusSchema = z.object({ date: isoDateSchema, status: entryTypeSchema });

/** FR-WEB-02 day-status pill for the caller's own day. */
export async function setDayStatusAction(input: { date: string; status: EntryType }): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    const parsed = dayStatusSchema.safeParse(input);
    if (!parsed.success) return fail((await getTranslations("myTime.server"))("pickStatus"));
    await setDayStatus(actor, actor.userId, parsed.data.date, parsed.data.status);
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}
