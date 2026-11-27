import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { IsoDate } from "@/contracts";
import { offices, projectPrompts, projects } from "../schema";
import type { DbOrTx } from "./types";

export interface PromptProjectRow {
  projectId: string;
  projectName: string;
  slackChannelId: string;
  statusPromptTime: string;
  officeId: string | null; // null → the UA office (resolved in project-prompt-decision)
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
