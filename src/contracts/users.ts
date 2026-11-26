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
});
export type SlackIdentity = z.infer<typeof slackIdentitySchema>;

/** Authenticated caller passed into every service function for RBAC (amendment A5). */
export interface Actor {
  userId: string;
  role: z.infer<typeof roleSchema>;
}
