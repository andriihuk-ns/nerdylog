import { z } from "zod";
import type {
  AssertProjectMember,
  DeleteProject,
  ListProjects,
  ProjectView,
  ReplaceProjectMembers,
  UpsertProject,
} from "@/contracts";
import { getDb } from "@/server/db/client";
import { findProjectRow, insertProject, listProjectRows, updateProject, type ProjectRow } from "@/server/db/queries/catalog";
import { officeExists } from "@/server/db/queries/offices";
import {
  deleteProjectRow,
  findUserIdsBySlackIds,
  isProjectMember,
  listProjectMemberRows,
  projectExists,
  projectHasTimeEntries,
  replaceProjectMemberRows,
} from "@/server/db/queries/projects";
import { InvalidInputError, NotFoundError } from "./errors";
import { isForeignKeyViolation, isUniqueViolation } from "./pg-errors";
import { assertAdmin } from "./rbac";
import { assertRowId, isRowId, parseInput, slackChannelIdSchema } from "./validation";

/** Postgres name of the projects.slack_channel_id unique constraint (drizzle/0003_project_channels.sql). */
export const PROJECTS_SLACK_CHANNEL_UNIQUE = "projects_slack_channel_id_unique";

/** Postgres name of the projects.status_prompt_office_id foreign key (drizzle/0014). */
export const PROJECTS_PROMPT_OFFICE_FK = "projects_status_prompt_office_id_offices_id_fk";

/** Postgres name of the time_entries.project_id foreign key (drizzle/0000_init.sql, ON DELETE restrict). */
export const TIME_ENTRIES_PROJECT_FK = "time_entries_project_id_projects_id_fk";

/** Field error code for logging to a project the user is not a member of (A15). */
export const NOT_PROJECT_MEMBER = "not_member";

/** A16: field error code (key "_") when deleting a project that has time entries; archive instead. */
export const PROJECT_HAS_ENTRIES = "has_entries";

/** A16: "HH:MM", 24 h (same pattern as the projects_status_prompt_time_check constraint). */
export const STATUS_PROMPT_TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** A15: a project is a name + Slack channel. The channel is required on create (checked in upsertProject). */
export const projectInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  slackChannelId: slackChannelIdSchema, // A11: one channel = one project
  isActive: z.boolean().optional(),
  statusPromptTime: z.string().trim().regex(STATUS_PROMPT_TIME_RE, "Use HH:MM (00:00–23:59)").optional(), // A16
  statusPromptOfficeId: z.uuid("Unknown office").nullable().optional(), // A16: null → UA office
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
 * `created_by` = actor; a new project needs a channel. A16: prompt time "HH:MM" (default "10:00") and
 * prompt office (must exist; null → UA) — omitted fields stay unchanged on update. Members are refreshed by the caller
 * (ReplaceProjectMembers) because reading the channel is a Slack call.
 */
export const upsertProject: UpsertProject = async (actor, input) => {
  assertAdmin(actor);
  const { id, ...values } = parseInput(projectInputSchema, input);
  if (!id && values.slackChannelId === null) {
    throw InvalidInputError.field("slackChannelId", "Pick a Slack channel for the new project");
  }
  const db = getDb();
  if (values.statusPromptOfficeId && !(await officeExists(db, values.statusPromptOfficeId))) {
    throw InvalidInputError.field("statusPromptOfficeId", "Unknown office");
  }
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
    if (isForeignKeyViolation(error, PROJECTS_PROMPT_OFFICE_FK)) {
      throw InvalidInputError.field("statusPromptOfficeId", "Unknown office");
    }
    throw error;
  }
};

/**
 * Contract DeleteProject (A16, admin). Only a project without time entries can go; otherwise
 * InvalidInputError { _: ["has_entries"] } (archive it instead). project_members and project_prompts
 * cascade. The FK on time_entries is ON DELETE restrict, so an entry written between the check and
 * the delete is reported the same way.
 */
export const deleteProject: DeleteProject = async (actor, id) => {
  assertAdmin(actor);
  assertRowId(id, "Project");
  const hasEntries = () => new InvalidInputError({ _: [PROJECT_HAS_ENTRIES] });
  try {
    await getDb().transaction(async (tx) => {
      if (!(await projectExists(tx, id))) throw new NotFoundError("Project not found");
      if (await projectHasTimeEntries(tx, id)) throw hasEntries();
      if (!(await deleteProjectRow(tx, id))) throw new NotFoundError("Project not found");
    });
  } catch (error) {
    if (isForeignKeyViolation(error, TIME_ENTRIES_PROJECT_FK)) throw hasEntries();
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
