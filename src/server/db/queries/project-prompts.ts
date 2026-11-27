import { and, asc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import type { IsoDate, Locale } from "@/contracts";
import { offices, projectMembers, projectPrompts, projects, users } from "../schema";
import type { DbOrTx } from "./types";

export interface PromptProjectRow {
  projectId: string;
  projectName: string;
  slackChannelId: string;
  statusPromptTime: string;
  officeId: string | null; // null → the UA office (resolved in project-prompt-decision)
  timezone: string | null; // A29: overrides the office zone
}

/** A16: active projects that have a Slack channel, with their prompt time and prompt office. */
export async function listPromptProjectRows(db: DbOrTx): Promise<PromptProjectRow[]> {
  const rows = await db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      slackChannelId: projects.slackChannelId,
      statusPromptTime: projects.statusPromptTime,
      officeId: projects.statusPromptOfficeId,
      timezone: projects.statusPromptTimezone,
    })
    .from(projects)
    .where(and(eq(projects.isActive, true), isNotNull(projects.slackChannelId)))
    .orderBy(asc(projects.name), asc(projects.id));
  return rows.flatMap((r) => (r.slackChannelId ? [{ ...r, slackChannelId: r.slackChannelId }] : []));
}

/** A16: every office's code and IANA timezone (a handful of rows). */
export async function listOfficeZones(db: DbOrTx): Promise<Array<{ id: string; code: string; timezone: string }>> {
  return db.select({ id: offices.id, code: offices.code, timezone: offices.timezone }).from(offices);
}

/** A16 dedup: insert … on conflict do nothing; returns only the project ids newly claimed. */
export async function claimProjectPromptRows(
  db: DbOrTx,
  rows: ReadonlyArray<{ projectId: string; promptDate: IsoDate }>,
): Promise<string[]> {
  if (rows.length === 0) return [];
  const inserted = await db
    .insert(projectPrompts)
    .values([...rows])
    .onConflictDoNothing()
    .returning({ projectId: projectPrompts.projectId });
  return inserted.map((r) => r.projectId);
}

/** A31: drops claims from `since` on, so a rescheduled prompt can be sent again the same day. */
export async function deleteProjectPromptsSince(db: DbOrTx, projectId: string, since: IsoDate): Promise<void> {
  await db.delete(projectPrompts).where(and(eq(projectPrompts.projectId, projectId), gte(projectPrompts.promptDate, since)));
}

/** A31: active members of each project (A32: with their locale); the prompt goes to them privately. */
export async function listPromptRecipientRows(
  db: DbOrTx,
  projectIds: readonly string[],
): Promise<Array<{ projectId: string; slackUserId: string; locale: Locale }>> {
  if (projectIds.length === 0) return [];
  return db
    .select({ projectId: projectMembers.projectId, slackUserId: users.slackUserId, locale: users.locale })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(and(inArray(projectMembers.projectId, [...projectIds]), eq(users.isActive, true)));
}
