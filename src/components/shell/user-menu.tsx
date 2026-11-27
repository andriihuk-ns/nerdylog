"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MyProfile } from "@/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/components/lib/format";
import { signOutAction } from "@/app/(dashboard)/sign-out-action";
import { profileDisplayName, profileSubtitle } from "./profile-label";
import { LocaleMenuRow } from "./locale-menu-group";
import { ThemeMenuRow } from "./theme-menu-row";
import { useActiveHref, type NavItem } from "./nav-links";

/** Avatar menu. A16: under 640px it also holds the page links (the top nav is hidden there). */
export function UserMenu({ profile, navItems, navLabel }: { profile: MyProfile; navItems: NavItem[]; navLabel: string }) {
  const t = useTranslations("userMenu");
  const tRole = useTranslations("roles");
  const name = profileDisplayName(profile, t("signedIn"));
  const active = useActiveHref(navItems);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hit-target inline-flex items-center justify-center rounded-full"
        aria-label={t("accountFor", { name })}
      >
        <Avatar>
          {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{profileSubtitle(profile, tRole(profile.role))}</span>
          {profile.email ? <span className="truncate text-xs text-muted-foreground">{profile.email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label={navLabel} className="sm:hidden">
          {navItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild className="min-h-11 font-medium data-[current=true]:bg-muted">
              <Link href={item.href} aria-current={active === item.href ? "page" : undefined} data-current={active === item.href}>
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="sm:hidden" />
        <DropdownMenuGroup>
          <ThemeMenuRow />
          <LocaleMenuRow />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild className="min-h-11">
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
