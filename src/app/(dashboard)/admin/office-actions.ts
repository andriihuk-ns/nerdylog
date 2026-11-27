"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { OfficeView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { deleteOffice, reorderOffices, upsertOffice } from "@/server/services/office-service";
import { actionError, fail, ok, type ActionResult } from "../action-result";
import { serverCopy } from "./channel-guard";

const ADMIN = ["admin"] as const;

const officeSchema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,8}$/)),
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(64).refine(isTimezone), // A16 IANA
});

function isTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type OfficeInput = z.input<typeof officeSchema>;

/** Admin: create or edit an office (code unique, 2–8 letters/digits, upper-case; A16 IANA timezone). */
export async function upsertOfficeAction(input: OfficeInput): Promise<ActionResult<OfficeView>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = officeSchema.safeParse(input);
    if (!parsed.success) {
      const t = await serverCopy();
      const field = parsed.error.issues[0]?.path[0];
      return fail(field === "code" ? t("officeCodeInvalid") : field === "timezone" ? t("timezoneInvalid") : t("nameRequired"));
    }
    const office: OfficeView = await upsertOffice(actor, parsed.data);
    refresh();
    return ok(office);
  } catch (err) {
    return actionError(err);
  }
}

/** A15 admin: only empty offices (no people, no holidays) can be deleted; the service enforces it. */
export async function deleteOfficeAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(ADMIN);
    if (!z.uuid().safeParse(id).success) return fail((await serverCopy())("unknownOffice"));
    await deleteOffice(actor, id);
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}

/** A30 admin: save the drag-and-drop order; the service validates the ids. */
export async function reorderOfficesAction(ids: string[]): Promise<ActionResult> {
  try {
    const actor = await requireActor(ADMIN);
    await reorderOffices(actor, ids);
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}
