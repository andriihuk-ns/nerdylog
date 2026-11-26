"use client";

import { useOptimistic, useTransition } from "react";
import { ROLES, type DirectoryUser, type Role } from "@/contracts";
import { cn } from "@/lib/utils";
import { updateDirectoryUserAction, type DirectoryPatch } from "@/app/(dashboard)/admin/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatCount, formatHours, initials } from "@/components/lib/format";
import { NumberCommitInput } from "./number-commit-input";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", manager: "Manager", member: "Member" };

interface Props {
  user: DirectoryUser;
  /** A13: handles of the user's active teams (read-only chips). */
  teamHandles: string[];
  onError: (message: string) => void;
}

/** One Team Directory row; every control saves optimistically and reverts on failure. */
export function DirectoryRow({ user, teamHandles, onError }: Props) {
  const [view, applyPatch] = useOptimistic(user, (u: DirectoryUser, patch: DirectoryPatch) => ({ ...u, ...patch }));
  const [pending, startTransition] = useTransition();

  function update(patch: DirectoryPatch) {
    startTransition(async () => {
      applyPatch(patch);
      const res = await updateDirectoryUserAction(user.id, patch);
      if (!res.ok) onError(`Couldn't update ${user.fullName}. ${res.message}`);
    });
  }

  return (
    <tr className={cn("border-b last:border-b-0", !view.isActive && "text-muted-foreground")} aria-busy={pending || undefined}>
      <th scope="row" className="px-4 py-2 text-left font-medium">
        <span className="flex items-center gap-3">
          <Avatar size="sm">
            {view.avatarUrl ? <AvatarImage src={view.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(view.fullName)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{view.fullName}</span>
            {view.email ? <span className="truncate text-xs font-normal text-muted-foreground">{view.email}</span> : null}
          </span>
        </span>
      </th>
      <td className="max-w-48 px-2 py-2 text-sm">
        {view.title ? (
          <span className="block truncate" title={view.title}>
            {view.title}
          </span>
        ) : (
          <span className="text-muted-foreground">
            <span aria-hidden>—</span>
            <span className="sr-only">No title in Slack</span>
          </span>
        )}
      </td>
      <td className="max-w-56 px-2 py-2">
        <TeamChips handles={teamHandles} />
      </td>
      <td className="px-2 py-2">
        <Select value={view.role} onValueChange={(role) => update({ role: role as Role })}>
          <SelectTrigger aria-label={`Role for ${view.fullName}`} className="hit-target w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-2 text-right">
        <NumberCommitInput
          key={view.dailyNormHours}
          value={view.dailyNormHours}
          label={`Daily norm hours for ${view.fullName}`}
          min={0.25}
          max={24}
          step={0.25}
          format={formatHours}
          onCommit={(n) => n !== null && update({ dailyNormHours: n })}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <NumberCommitInput
          key={view.ptoAllowanceDays ?? "none"}
          value={view.ptoAllowanceDays}
          label={`Yearly vacation allowance in days for ${view.fullName}`}
          min={0}
          max={366}
          step={0.5}
          allowEmpty
          format={formatCount}
          onCommit={(n) => update({ ptoAllowanceDays: n })}
        />
      </td>
      <td className="px-4 py-2">
        <span className="flex items-center gap-2">
          <Switch
            checked={view.isActive}
            onCheckedChange={(isActive) => update({ isActive })}
            aria-label={`${view.fullName} active`}
          />
          <span className="text-xs">{view.isActive ? "Active" : "Archived"}</span>
        </span>
      </td>
    </tr>
  );
}

function TeamChips({ handles }: { handles: string[] }) {
  if (handles.length === 0) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">No team</span>
      </span>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Teams">
      {handles.map((h) => (
        <li key={h} className="rounded-full border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          @{h}
        </li>
      ))}
    </ul>
  );
}
