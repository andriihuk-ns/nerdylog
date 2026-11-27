"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listProjects, upsertProject } from "@/server/services/project-service";
import { actionError, fail, ok, type ActionResult } from "../action-result";
import { channelFailure, channelFieldError, type ChannelActionResult } from "./channel-result";
import { channelIdSchema, ensureBotInChannel, serverCopy } from "./channel-guard";
import { refreshMembers } from "./project-members";
import type { MemberRefresh } from "./sync-result";

const ADMIN = ["admin"] as const;

const projectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  slackChannelId: channelIdSchema,
  isActive: z.boolean(),
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
