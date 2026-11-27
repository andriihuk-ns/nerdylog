import { z } from "zod";
import type { DeleteOffice, ListOffices, UpsertOffice } from "@/contracts";
import { getDb } from "@/server/db/client";
import {
  countOfficeUsage,
  deleteOfficeRow,
  findOfficeView,
  insertOffice,
  listOfficeViews,
  updateOffice,
} from "@/server/db/queries/offices";
import { InvalidInputError, NotFoundError } from "./errors";
import { isUniqueViolation } from "./pg-errors";
import { assertAdmin } from "./rbac";
import { assertRowId, parseInput } from "./validation";

/** Postgres name of the offices.code unique constraint (drizzle/0011). */
export const OFFICES_CODE_UNIQUE = "offices_code_unique";

/** Code is trimmed and uppercased, then must be 2–6 Latin letters ("UA", "PL"). */
export const officeInputSchema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .transform((c) => c.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2,6}$/, "Use 2–6 letters")),
  name: z.string().trim().min(1, "Name is required").max(100),
});

/** Contract ListOffices: any signed-in user. */
export const listOffices: ListOffices = async () => listOfficeViews(getDb());

/** Contract UpsertOffice (admin). With `id` → update (NotFoundError if missing), else insert. */
export const upsertOffice: UpsertOffice = async (actor, input) => {
  assertAdmin(actor);
  const { id, ...values } = parseInput(officeInputSchema, input);
  const db = getDb();
  try {
    const officeId = id ?? (await insertOffice(db, values));
    if (id && !(await updateOffice(db, id, values))) throw new NotFoundError("Office not found");
    const view = await findOfficeView(db, officeId);
    if (!view) throw new NotFoundError("Office not found");
    return view;
  } catch (error) {
    if (isUniqueViolation(error, OFFICES_CODE_UNIQUE)) {
      throw InvalidInputError.field("code", "Another office already uses this code");
    }
    throw error;
  }
};

/** Contract DeleteOffice (admin). Only an office with no people and no holidays can go. */
export const deleteOffice: DeleteOffice = async (actor, id) => {
  assertAdmin(actor);
  assertRowId(id, "Office");
  const db = getDb();
  const usage = await countOfficeUsage(db, id);
  if (usage.members > 0 || usage.holidays > 0) {
    const fieldErrors: Record<string, string[]> = {};
    if (usage.members > 0) fieldErrors.members = ["Move the office's people to another office first"];
    if (usage.holidays > 0) fieldErrors.holidays = ["Remove the office's holidays first"];
    throw new InvalidInputError(fieldErrors);
  }
  if (!(await deleteOfficeRow(db, id))) throw new NotFoundError("Office not found");
};
