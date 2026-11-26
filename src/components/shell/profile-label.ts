import type { MyProfile } from "@/contracts";

/** Name shown in the avatar menu; blank names fall back to email, then `fallback` ("Signed in"). */
export function profileDisplayName(profile: Pick<MyProfile, "fullName" | "email">, fallback: string): string {
  return profile.fullName.trim() || profile.email?.trim() || fallback;
}

/** A12: the Slack title under the name; `roleLabel` (translated role) when the title is missing. */
export function profileSubtitle(profile: Pick<MyProfile, "title">, roleLabel: string): string {
  return profile.title?.trim() || roleLabel;
}
