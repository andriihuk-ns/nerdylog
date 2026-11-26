import { pgEnum } from "drizzle-orm/pg-core";
// Relative import (not "@/"): drizzle-kit loads this file outside the Next.js/TS path-alias setup.
import {
  ENTRY_SOURCES,
  ENTRY_TYPES,
  ROLES,
  SLACK_SUBMISSION_KINDS,
} from "../../../contracts/enums";

/** Postgres enums. Value lists come from src/contracts/enums.ts; never retype them here. */
export const roleEnum = pgEnum("role", ROLES);
export const entryTypeEnum = pgEnum("entry_type", ENTRY_TYPES);
export const entrySourceEnum = pgEnum("entry_source", ENTRY_SOURCES);
export const slackSubmissionKindEnum = pgEnum("slack_submission_kind", SLACK_SUBMISSION_KINDS);
