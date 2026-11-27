import { z } from "zod";
import type { AssertProjectMember, ListProjects, ProjectView, ReplaceProjectMembers, UpsertProject } from "@/contracts";
import { getDb } from "@/server/db/client";
import { findProjectRow, insertProject, listProjectRows, updateProject, type ProjectRow } from "@/server/db/queries/catalog";
import {
  findUserIdsBySlackIds,
  isProjectMember,
  listProjectMemberRows,
  projectExists,
  replaceProjectMemberRows,
} from "@/server/db/queries/projects";
import { InvalidInputError, NotFoundError } from "./errors";
import { isUniqueViolation } from "./pg-errors";
import { assertAdmin } from "./rbac";
import { isRowId, parseInput, slackChannelIdSchema } from "./validation";

/** Postgres name of the projects.slack_channel_id unique constraint (drizzle/0003_project_channels.sql). */
export const PROJECTS_SLACK_CHANNEL_UNIQUE = "projects_slack_channel_id_unique";

/** Field error code for logging to a project the user is not a member of (A15). */
export const NOT_PROJECT_MEMBER = "not_member";

/** A15: a project is a name + Slack channel. The channel is required on create (checked in upsertProject). */
export const projectInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  slackChannelId: slackChannelIdSchema, // A11: one channel = one project
  isActive: z.boolean().optional(),
});

function toView(row: ProjectRow, memberIds: string[], actorId: string): ProjectView {
  return { ...row, memberIds, isMember: memberIds.includes(actorId) };
}

/**
 * Contract ListProjects (A15). Everyone sees all projects, with cached member ids and whether the
 * actor is a member (non-members see "Ask {creator} to add you to #channel").
 */
export const listProjects: ListProjects = async (actor, opts) => {
  const db = getDb();
  const rows = await listProjectRows(db, opts?.includeArchived ?? false);
  const members = await listProjectMemberRows(db, { projectIds: rows.map((r) => r.id) });
  const byProject = new Map<string, string[]>();
  for (const m of members) byProject.set(m.projectId, [...(byProject.get(m.projectId) ?? []), m.userId]);
  return rows.map((r) => toView(r, byProject.get(r.id) ?? [], actor.userId));
};

/**
 * Contract UpsertProject (admin). With `id` → update (NotFoundError if missing), else insert with
 * `created_by` = actor; a new project needs a channel. Members are refreshed by the caller
 * (ReplaceProjectMembers) because reading the channel is a Slack call.
 */
export const upsertProject: UpsertProject = async (actor, input) => {
  assertAdmin(actor);
  const { id, ...values } = parseInput(projectInputSchema, input);
  if (!id && values.slackChannelId === null) {
    throw InvalidInputError.field("slackChannelId", "Pick a Slack channel for the new project");
  }
  const db = getDb();
  try {
    const projectId = id ?? (await insertProject(db, { ...values, createdBy: actor.userId }));
    if (id && !(await updateProject(db, id, values))) throw new NotFoundError("Project not found");
    const row = await findProjectRow(db, projectId);
    if (!row) throw new NotFoundError("Project not found");
    const members = await listProjectMemberRows(db, { projectIds: [projectId] });
    return toView(
      row,
      members.map((m) => m.userId),
      actor.userId,
    );
  } catch (error) {
    if (isUniqueViolation(error, PROJECTS_SLACK_CHANNEL_UNIQUE)) {
      throw InvalidInputError.field("slackChannelId", "This channel is already linked to another project");
    }
    throw error;
  }
};

/**
 * Contract ReplaceProjectMembers: system call (no actor; callers check admin first). Replaces the
 * cached members with the Tempo users among `memberSlackIds`; unknown Slack ids are counted as skipped.
 */
export const replaceProjectMembers: ReplaceProjectMembers = async (projectId, memberSlackIds) => {
  if (!isRowId(projectId)) throw new NotFoundError("Project not found");
  const slackIds = [...new Set(memberSlackIds.map((s) => s.trim()).filter((s) => s !== ""))];
  return getDb().transaction(async (tx) => {
    if (!(await projectExists(tx, projectId))) throw new NotFoundError("Project not found");
    const userIds = await findUserIdsBySlackIds(tx, slackIds);
    await replaceProjectMemberRows(tx, projectId, userIds);
    return { members: userIds.length, skipped: slackIds.length - userIds.length };
  });
};

/**
 * Contract AssertProjectMember (A15). Throws InvalidInputError { projectId: ["not_member"] } unless
 * `userId` is a cached member of `projectId`. Malformed ids are never members.
 */
export const assertProjectMember: AssertProjectMember = async (userId, projectId) => {
  if (isRowId(userId) && isRowId(projectId) && (await isProjectMember(getDb(), userId, projectId))) return;
  throw InvalidInputError.field("projectId", NOT_PROJECT_MEMBER);
};
