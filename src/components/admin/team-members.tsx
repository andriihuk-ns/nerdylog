import type { DirectoryUser } from "@/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/components/lib/format";

const MAX_FACES = 5;

/** Overlapping member avatars (first five) + count. Names are in the tooltip and for screen readers. */
export function TeamMembers({ members }: { members: DirectoryUser[] }) {
  if (members.length === 0) return <span className="text-sm text-muted-foreground">No members in nerdylog</span>;
  const names = members.map((m) => m.fullName).join(", ");

  return (
    <span className="flex items-center gap-2" title={names}>
      <span aria-hidden className="flex -space-x-2">
        {members.slice(0, MAX_FACES).map((m) => (
          <Avatar key={m.id} size="sm" className="ring-2 ring-card">
            {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(m.fullName)}</AvatarFallback>
          </Avatar>
        ))}
      </span>
      <span className="text-sm text-muted-foreground">
        <span className="tabular">{members.length}</span>
        <span className="sr-only">{` members: ${names}`}</span>
      </span>
    </span>
  );
}
