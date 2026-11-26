import { requireActor } from "@/server/auth/session";
import { Skeleton } from "@/components/ui/skeleton";
import { NavLinks, type NavItem } from "./nav-links";
import { getShellProfile } from "./profile";
import { UserMenu } from "./user-menu";

/** Role-aware nav + avatar menu. Reads the session, so it renders inside <Suspense>. */
export async function ShellNav() {
  const actor = await requireActor();
  const profile = await getShellProfile();
  const items: NavItem[] = [{ href: "/my-time", label: "My Time" }];
  if (actor.role === "manager" || actor.role === "admin") items.push({ href: "/team", label: "Team" });
  if (actor.role === "admin") items.push({ href: "/admin", label: "Admin" });

  return (
    <>
      <NavLinks items={items} />
      <div className="ml-auto flex items-center">
        <UserMenu profile={profile} role={actor.role} />
      </div>
    </>
  );
}

export function ShellNavSkeleton() {
  return (
    <>
      <div className="flex items-center gap-4" aria-hidden>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="ml-auto size-8 rounded-full" aria-hidden />
    </>
  );
}
