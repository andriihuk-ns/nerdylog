import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "./supabase-config";

/** Browser Supabase client (anon key + session cookies). Use only in Client Components. */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = supabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
