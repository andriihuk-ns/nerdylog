import type { SlackDirectoryMember } from "@/contracts";

/** The users.list member fields we read (subset of @slack/web-api's Member). */
export interface SlackListMember {
  id?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  is_workflow_bot?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  name?: string;
  real_name?: string;
  tz?: string;
  profile?: {
    real_name?: string;
    display_name?: string;
    email?: string;
    image_192?: string;
    image_72?: string;
    title?: string;
  };
}

const SLACKBOT_ID = "USLACKBOT";

/** People only: no bots/apps/workflows, no deactivated users, no Slackbot, no guests. */
export function isDirectoryPerson(m: SlackListMember): m is SlackListMember & { id: string } {
  if (!m.id || m.id === SLACKBOT_ID) return false;
  if (m.deleted || m.is_bot || m.is_app_user || m.is_workflow_bot) return false;
  if (m.is_restricted || m.is_ultra_restricted) return false; // multi- and single-channel guests
  return true;
}

export function toDirectoryMember(m: SlackListMember & { id: string }): SlackDirectoryMember {
  const fullName = m.profile?.real_name || m.real_name || m.profile?.display_name || m.name || "";
  return {
    slackUserId: m.id,
    fullName: fullName.trim(),
    email: m.profile?.email || null,
    avatarUrl: m.profile?.image_192 || m.profile?.image_72 || null,
    timezone: m.tz || null,
    title: m.profile?.title?.trim() || null, // A12: blank → null
  };
}

export function toDirectoryMembers(members: SlackListMember[]): SlackDirectoryMember[] {
  return members.filter(isDirectoryPerson).map(toDirectoryMember);
}
