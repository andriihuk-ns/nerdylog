import { z } from "zod";
import { roleSchema } from "./enums";

/** Identity returned by Sign in with Slack (OIDC claims, normalised by the auth layer). */
export const slackIdentitySchema = z.object({
  authUserId: z.uuid(), // Supabase auth.users.id
  slackUserId: z.string().min(1), // OIDC "https://slack.com/user_id"
  email: z.email().nullable(),
  fullName: z.string().default(""),
  avatarUrl: z.url().nullable(),
  timezone: z.string().nullable(), // IANA tz; null → keep existing / DB default
  title: z.string().nullable().default(null), // A12: Slack profile title; null → keep existing
});
export type SlackIdentity = z.infer<typeof slackIdentitySchema>;

/** Authenticated caller passed into every service function for RBAC (amendment A5). */
export interface Actor {
  userId: string;
  role: z.infer<typeof roleSchema>;
}

/** Actor plus the Slack-facing profile; returned for active users only. */
export interface SlackActorProfile extends Actor {
  slackUserId: string;
  fullName: string;
  avatarUrl: string | null;
  timezone: string;
}

/** A12: the signed-in user's own profile for the shell and page defaults. */
export interface MyProfile {
  userId: string;
  role: z.infer<typeof roleSchema>;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  title: string | null;
  timezone: string;
}
