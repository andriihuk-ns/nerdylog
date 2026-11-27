import { getLocale, getTranslations } from "next-intl/server";
import { requireActor } from "@/server/auth/session";
import { Skeleton } from "@/components/ui/skeleton";
import { NavLinks, type NavItem } from "./nav-links";
import { LocaleSync } from "./locale-sync";
import { getCurrentProfile } from "./profile";
import { UserMenu } from "./user-menu";

/**
 * Role-aware nav + avatar menu. Reads the session, so it renders inside <Suspense>.
 * A14: when the cookie locale differs from the saved users.locale, LocaleSync copies the saved one
 * into the cookie and refreshes (the saved choice wins after sign-in).
 */
export async function ShellNav() {
  const actor = await requireActor();
  const [profile, locale, t] = await Promise.all([getCurrentProfile(), getLocale(), getTranslations("nav")]);
  const items: NavItem[] = [{ href: "/my-time", label: t("myTime") }];
  if (actor.role === "manager" || actor.role === "admin") items.push({ href: "/team", label: t("team") });
  if (actor.role === "admin") items.push({ href: "/admin", label: t("admin") });

  return (
    <>
      {profile.locale && profile.locale !== locale ? <LocaleSync locale={profile.locale} /> : null}
      <NavLinks items={items} label={t("main")} />
      <div className="ml-auto flex items-center">
        <UserMenu profile={profile} navItems={items} navLabel={t("main")} />
      </div>
    </>
  );
}

export function ShellNavSkeleton() {
  return (
    <>
      <div className="hidden items-center gap-4 sm:flex" aria-hidden>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="ml-auto size-8 rounded-full" aria-hidden />
    </>
  );
}
