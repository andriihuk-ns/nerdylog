"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { LOGIN_PATH } from "@/server/auth/route-rules";

/** POST from the avatar menu. Clears the Supabase session cookies, then goes to /login. */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
