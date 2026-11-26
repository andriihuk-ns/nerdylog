"use client";

import { LogOut } from "lucide-react";
import type { Role } from "@/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/components/lib/format";
import { signOutAction } from "@/app/(dashboard)/sign-out-action";
import type { ShellProfile } from "./profile";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", manager: "Manager", member: "Member" };

export function UserMenu({ profile, role }: { profile: ShellProfile; role: Role }) {
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
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
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
