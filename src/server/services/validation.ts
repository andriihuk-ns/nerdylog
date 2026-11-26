import { z } from "zod";
import { isoDateSchema, type IsoDate } from "@/contracts";
import { addDays } from "./calendar";
import { InvalidInputError, NotFoundError, type FieldErrors } from "./errors";

/** Groups Zod issues by dotted path; root-level issues go under "_". */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Parse or throw InvalidInputError with field-level messages. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new InvalidInputError(zodFieldErrors(result.error));
  return result.data;
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). Throws RangeError otherwise. */
export function assertIsoDate(value: string, label = "date"): IsoDate {
  if (!isoDateSchema.safeParse(value).success) throw new RangeError(`Invalid ${label}: ${value}`);
  addDays(value, 0); // calendar check; throws RangeError for impossible dates
  return value;
}

/** A11: Slack channel id (public `C…` or legacy private `G…`). */
export const SLACK_CHANNEL_ID_PATTERN = /^[CG][A-Z0-9]{8,}$/;

/** Blank → null; otherwise must look like a Slack channel id. */
export const slackChannelIdSchema = z
  .string()
  .trim()
  .nullable()
  .transform((c) => (c ? c : null))
  .refine((c) => c === null || SLACK_CHANNEL_ID_PATTERN.test(c), "Not a valid Slack channel id");

const uuidSchema = z.uuid();

export function isRowId(id: string): boolean {
  return uuidSchema.safeParse(id).success;
}

/** Row ids are uuids; anything else cannot exist (and would make Postgres throw 22P02). */
export function assertRowId(id: string, what: string): void {
  if (!isRowId(id)) throw new NotFoundError(`${what} not found`);
}

/** True when `tz` is an IANA zone this runtime knows. */
export function isValidTimeZone(tz: string): boolean {
  if (tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
