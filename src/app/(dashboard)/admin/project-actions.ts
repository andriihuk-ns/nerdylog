"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { MAX_MONTH_ALLOCATION_HOURS, type ProjectMemberAllocation, type ProjectView, type SlackChannelOption } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { deleteProject, listProjects, updateProjectMemberAllocation, upsertProject } from "@/server/services/project-service";
import { listSlackChannelsCached } from "@/server/slack/channels";
import { actionError, fail, fieldErrorCode, ok, type ActionResult } from "../action-result";
import { channelFailure, channelFieldError, type ChannelActionResult } from "./channel-result";
import { channelIdSchema, ensureBotInChannel, serverCopy } from "./channel-guard";
import { refreshMembers } from "./project-members";
import type { MemberRefresh } from "./sync-result";

const ADMIN = ["admin"] as const;

/** Refreshes public and bot-visible private channels when an admin opens a project picker. */
export async function refreshSlackChannelsAction(): Promise<ActionResult<SlackChannelOption[]>> {
  try {
    await requireActor(ADMIN);
    return ok(await listSlackChannelsCached({ refresh: true }));
  } catch (err) {
    return actionError(err);
  }
}

const projectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  slackChannelId: channelIdSchema,
  isActive: z.boolean(),
  statusPromptTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), // A16 "HH:MM"
  statusPromptOfficeId: z.uuid().nullable().optional(), // A16 (null → UA)
});

export type ProjectInput = z.input<typeof projectSchema>;

/** Saved project + member refresh outcome (null → refresh failed or no channel; the save still stands). */
export interface ProjectSaveResult {
  project: ProjectView;
  members: MemberRefresh | null;
}

/** A15: name + channel (required on create) + active; then refresh members from the channel. */
export async function upsertProjectAction(input: ProjectInput): Promise<ChannelActionResult<ProjectSaveResult>> {
  try {
    const actor = await requireActor(ADMIN);
    const t = await serverCopy();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      if (field === "slackChannelId") return channelFailure(t("invalidChannel"));
      if (field === "statusPromptTime") return fail(t("promptTimeInvalid"));
      return fail(field === "name" ? t("nameRequired") : t("projectInvalid"));
    }
    const { id, slackChannelId } = parsed.data;
    if (!id && !slackChannelId) return channelFailure(t("channelRequired"));
    const projects: ProjectView[] = await listProjects(actor, { includeArchived: true });
    const current = projects.find((p) => p.id === id);
    if (slackChannelId) {
      const owner = projects.find((p) => p.slackChannelId === slackChannelId && p.id !== id);
      if (owner) return channelFailure(t("alreadyLinkedProject", { name: owner.name }));
      if (current?.slackChannelId !== slackChannelId) {
        const failure = await ensureBotInChannel(slackChannelId);
        if (failure) return failure;
      }
    }
    const project: ProjectView = await upsertProject(actor, parsed.data);
    let members: MemberRefresh | null = null;
    if (project.slackChannelId) {
      try {
        members = await refreshMembers(project.id, project.slackChannelId);
      } catch (err) {
        console.warn("member refresh after save failed", err instanceof Error ? err.message : err);
      }
    }
    refresh();
    return ok({ project, members });
  } catch (err) {
    return channelFieldError(err) ?? actionError(err);
  }
}

/** A16 admin: delete a project with no time entries; otherwise "Has logged hours — archive instead". */
export async function deleteProjectAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(ADMIN);
    const t = await serverCopy();
    if (!z.uuid().safeParse(id).success) return fail(t("unknownProject"));
    try {
      await deleteProject(actor, id);
    } catch (err) {
      if (fieldErrorCode(err, "_") === "has_entries") return fail(t("hasEntries"));
      throw err;
    }
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}

/** A15 "Refresh members": re-read the project's Slack channel members. */
export async function refreshProjectMembersAction(projectId: string): Promise<ActionResult<MemberRefresh>> {
  try {
    const actor = await requireActor(ADMIN);
    const t = await serverCopy();
    if (!z.uuid().safeParse(projectId).success) return fail(t("unknownProject"));
    const projects: ProjectView[] = await listProjects(actor, { includeArchived: true });
    const project = projects.find((p) => p.id === projectId);
    if (!project) return fail(t("unknownProject"));
    if (!project.slackChannelId) return fail(t("noChannelToRefresh"));
    const outcome = await refreshMembers(project.id, project.slackChannelId);
    if (outcome.status === "ok") refresh();
    return ok(outcome);
  } catch (err) {
    return actionError(err);
  }
}

const allocationSchema = z.object({
  projectId: z.uuid(),
  userId: z.uuid(),
  hoursPerMonth: z.number().min(0.5).max(MAX_MONTH_ALLOCATION_HOURS).multipleOf(0.5),
});

/** A26: save one member's monthly allocation in the project. */
export async function updateProjectMemberAllocationAction(
  projectId: string,
  userId: string,
  hoursPerMonth: number,
): Promise<ActionResult<ProjectMemberAllocation>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = allocationSchema.parse({ projectId, userId, hoursPerMonth });
    const member = await updateProjectMemberAllocation(actor, parsed.projectId, parsed.userId, parsed.hoursPerMonth);
    refresh();
    return ok(member);
  } catch (err) {
    return actionError(err);
  }
}
