"use client";

import { useId } from "react";
import { LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { Role } from "@/contracts";
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
import type { ShellProfile } from "./profile";
import { parseThemePref, THEME_LABEL, THEME_ORDER, type ThemePref } from "./theme";
import { useTheme } from "./use-theme";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", manager: "Manager", member: "Member" };
const THEME_ICON: Record<ThemePref, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };

export function UserMenu({ profile, role }: { profile: ShellProfile; role: Role }) {
  const { choice, setChoice } = useTheme();
  const themeLabelId = useId();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hit-target inline-flex items-center justify-center rounded-full"
        aria-label={`Account menu for ${profile.name}`}
      >
        <Avatar>
          {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(profile.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{profile.name}</span>
          <span className="text-xs text-muted-foreground">
            {ROLE_LABEL[role]}
            {profile.email ? ` · ${profile.email}` : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel id={themeLabelId} className="text-xs font-medium text-muted-foreground">
            Theme
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
                  {THEME_LABEL[pref]}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild className="min-h-11">
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
