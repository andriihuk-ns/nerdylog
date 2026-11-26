import "server-only";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";

export interface ShellProfile {
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Name and avatar for the avatar menu, read from the verified Slack OIDC claims.
 * Actor carries only id + role, so this avoids an extra service call.
 */
export async function getShellProfile(): Promise<ShellProfile> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const meta: Record<string, unknown> = claims?.user_metadata ?? {};
  const email = str(claims?.email) ?? str(meta.email);
  return {
    name: str(meta.full_name) ?? str(meta.name) ?? email ?? "Signed in",
    email,
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
  };
}
