/**
 * Public Supabase settings shared by the server, browser and proxy clients.
 * Read directly from process.env (not src/lib/env.ts) because that module is server-only and
 * validates every secret; the anon key and URL are public and inlined into the browser bundle.
 */
export function supabasePublicConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  return { url, anonKey };
}
