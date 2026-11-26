import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Actor, Role } from "@/contracts";
import { getActorByAuthUserId } from "@/server/services/user-service";
import { createSupabaseServerClient } from "./supabase-server";
import { LOGIN_PATH } from "./route-rules";

/** Thrown by requireActor when the caller is signed in but lacks the required role. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Current Tempo actor, or null when signed out or not linked to a Tempo user.
 * getClaims() verifies the JWT (never trust getSession() on the server). Deduped per request.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (error || !authUserId) return null;
  return getActorByAuthUserId(authUserId);
});

/**
 * For Server Components and Server Actions. Signed out → redirect to /login.
 * Signed in with a role outside `roles` → throws ForbiddenError (render it in an error boundary,
 * or catch it in the action and return a typed error).
 */
export async function requireActor(roles?: readonly Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(LOGIN_PATH);
  if (roles && roles.length > 0 && !roles.includes(actor.role)) {
    throw new ForbiddenError(`Requires role: ${roles.join(" | ")}`);
  }
  return actor;
}
