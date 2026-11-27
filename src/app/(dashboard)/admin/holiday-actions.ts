"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isoDateSchema, type HolidayView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { addHoliday, copyHolidays, removeHoliday } from "@/server/services/holiday-service";
import { actionError, fail, ok, type ActionResult } from "../action-result";
import { serverCopy } from "./channel-guard";

const ADMIN = ["admin"] as const;

const holidaySchema = z.object({
  officeId: z.uuid(),
  holidayDate: isoDateSchema,
  name: z.string().trim().min(1).max(120),
});

export async function addHolidayAction(input: z.input<typeof holidaySchema>): Promise<ActionResult<HolidayView>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = holidaySchema.safeParse(input);
    if (!parsed.success) {
      const t = await serverCopy();
      return fail(parsed.error.issues[0]?.path[0] === "name" ? t("nameRequired") : t("holidayInvalid"));
    }
    const holiday: HolidayView = await addHoliday(actor, parsed.data);
    refresh();
    return ok(holiday);
  } catch (err) {
    return actionError(err);
  }
}

export async function removeHolidayAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(ADMIN);
    if (!z.uuid().safeParse(id).success) return fail((await serverCopy())("unknownHoliday"));
    await removeHoliday(actor, id);
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}

const copySchema = z.object({
  officeId: z.uuid(),
  fromYear: z.number().int().min(2000).max(2100),
  toYear: z.number().int().min(2000).max(2100),
});

/** A15 "Copy from {year-1}": same day/month; dates that already exist are skipped. */
export async function copyHolidaysAction(input: z.input<typeof copySchema>): Promise<ActionResult<{ copied: number; skipped: number }>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = copySchema.safeParse(input);
    if (!parsed.success || parsed.data.fromYear === parsed.data.toYear) return fail((await serverCopy())("holidayInvalid"));
    const { officeId, fromYear, toYear } = parsed.data;
    const counts: { copied: number; skipped: number } = await copyHolidays(actor, officeId, fromYear, toYear);
    refresh();
    return ok(counts);
  } catch (err) {
    return actionError(err);
  }
}
