import type { MyProfile, Role } from "@/contracts";

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", manager: "Manager", member: "Member" };

/** Name shown in the avatar menu; blank names fall back to email, then a neutral label. */
export function profileDisplayName(profile: Pick<MyProfile, "fullName" | "email">): string {
  return profile.fullName.trim() || profile.email?.trim() || "Signed in";
}

/** A12: the Slack title under the name; the role label when the title is missing. */
export function profileSubtitle(profile: Pick<MyProfile, "title" | "role">): string {
  return profile.title?.trim() || ROLE_LABEL[profile.role];
}
