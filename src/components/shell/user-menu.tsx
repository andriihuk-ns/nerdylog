"use client";

import { useId } from "react";
import { LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MyProfile } from "@/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/components/lib/format";
import { signOutAction } from "@/app/(dashboard)/sign-out-action";
import { profileDisplayName, profileSubtitle } from "./profile-label";
import { LocaleMenuGroup } from "./locale-menu-group";
import { parseThemePref, THEME_ORDER, type ThemePref } from "./theme";
import { useTheme } from "./use-theme";

const THEME_ICON: Record<ThemePref, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };

export function UserMenu({ profile }: { profile: MyProfile }) {
  const t = useTranslations("userMenu");
  const tRole = useTranslations("roles");
  const name = profileDisplayName(profile, t("signedIn"));
  const { choice, setChoice } = useTheme();
  const themeLabelId = useId();
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
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{profileSubtitle(profile, tRole(profile.role))}</span>
          {profile.email ? <span className="truncate text-xs text-muted-foreground">{profile.email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel id={themeLabelId} className="text-xs font-medium text-muted-foreground">
            {t("theme")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            aria-labelledby={themeLabelId}
            value={choice}
            onValueChange={(v) => setChoice(parseThemePref(v))}
          >
            {THEME_ORDER.map((pref) => {
              const Icon = THEME_ICON[pref];
              return (
                <DropdownMenuRadioItem key={pref} value={pref} className="min-h-11">
                  <Icon aria-hidden />
                  {t(`themes.${pref}`)}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <LocaleMenuGroup />
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
