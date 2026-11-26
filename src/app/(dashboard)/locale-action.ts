"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { LOCALE_COOKIE, localeSchema, type Locale } from "@/contracts";
import { getActor } from "@/server/auth/session";
import { setMyLocale } from "@/server/services/user-service";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

async function writeLocaleCookie(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * A14 language switcher (login screen + avatar menu). Sets the NEXT_LOCALE cookie; when signed
 * in, also saves users.locale so Slack DMs follow. Then refreshes the current route.
 */
export async function setLocaleAction(locale: Locale): Promise<{ ok: boolean }> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { ok: false };
  await writeLocaleCookie(parsed.data);
  let saved = true;
  try {
    const actor = await getActor();
    if (actor) await setMyLocale(actor, parsed.data);
  } catch (err) {
    unstable_rethrow(err);
    console.error("setMyLocale failed", err instanceof Error ? err.message : err);
    saved = false;
  }
  refresh();
  return { ok: saved };
}

/** A14: after sign-in the saved users.locale wins; the shell calls this once to copy it into the cookie. */
export async function syncLocaleCookieAction(locale: Locale): Promise<void> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return;
  await writeLocaleCookie(parsed.data);
  refresh();
}
