import "server-only";
import { cache } from "react";
import type { MyProfile } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { getMyProfile } from "@/server/services/user-service";

/**
 * A12: the signed-in user's profile (name, avatar, title, timezone, role), fetched once per
 * request. The shell and pages share it, so "today" uses the actor's own timezone.
 */
export const getCurrentProfile = cache(async (): Promise<MyProfile> => {
  const actor = await requireActor();
  return getMyProfile(actor);
});
