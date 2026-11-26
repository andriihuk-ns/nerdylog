import { z } from "zod";
import type { ListProjects, UpsertProject } from "@/contracts";
import { getDb } from "@/server/db/client";
import { insertProject, listProjectViews, updateProject } from "@/server/db/queries/catalog";
import { InvalidInputError, NotFoundError } from "./errors";
import { isUniqueViolation } from "./pg-errors";
import { assertAdmin } from "./rbac";
import { parseInput, slackChannelIdSchema } from "./validation";

/** Postgres name of the projects.code unique constraint (drizzle/0000_init.sql). */
export const PROJECTS_CODE_UNIQUE = "projects_code_unique";
/** Postgres name of the projects.slack_channel_id unique constraint (drizzle/0003_project_channels.sql). */
export const PROJECTS_SLACK_CHANNEL_UNIQUE = "projects_slack_channel_id_unique";

/** Blank code → null. Cap mirrors numeric(5,1); null = no client cap. */
export const projectInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z
    .string()
    .trim()
    .max(32)
    .nullable()
    .transform((c) => (c ? c : null)),
  monthlyHourCap: z.number().gt(0).max(9999.9).multipleOf(0.1).nullable(),
  isBillable: z.boolean(),
  isActive: z.boolean(),
  slackChannelId: slackChannelIdSchema, // A11: one channel = one project
});

/** Contract ListProjects. Any signed-in user (projects are not per-user data). */
export const listProjects: ListProjects = async (_actor, opts) => {
  return listProjectViews(getDb(), opts?.includeArchived ?? false);
};

/** Contract UpsertProject (admin). With `id` → update (NotFoundError if missing), else insert. */
export const upsertProject: UpsertProject = async (actor, input) => {
  assertAdmin(actor);
  const { id, ...values } = parseInput(projectInputSchema, input);
  const db = getDb();
  try {
    if (!id) return await insertProject(db, values);
    const row = await updateProject(db, id, values);
    if (!row) throw new NotFoundError("Project not found");
    return row;
  } catch (error) {
    if (isUniqueViolation(error, PROJECTS_CODE_UNIQUE)) {
      throw InvalidInputError.field("code", "Another project already uses this code");
    }
    if (isUniqueViolation(error, PROJECTS_SLACK_CHANNEL_UNIQUE)) {
      throw InvalidInputError.field("slackChannelId", "This channel is already linked to another project");
    }
    throw error;
  }
};
