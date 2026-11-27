"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DirectoryUser } from "@/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SortableHead } from "@/components/shell/sortable-head";
import { CARD_FRAME, CARD_ROW, CARD_TABLE, TABLE_EDGE_PADDING } from "@/components/shell/table-styles";
import { initials } from "@/components/lib/format";
import { useTableSort } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";

const COLUMNS = ["name", "title", "role", "status"] as const;

/** People of one office, read-only; assignment stays in the Directory. A row opens the person. */
export function OfficePeople({ users }: { users: DirectoryUser[] }) {
  const t = useTranslations("admin.directory");
  const to = useTranslations("admin.offices");
  const tRole = useTranslations("roles");
  const tc = useTranslations("common");
  const router = useRouter();
  const sorted = [...users].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName));
  const sort = useTableSort<DirectoryUser, (typeof COLUMNS)[number]>(sorted, (u) => u.id, {
    name: (u) => u.fullName,
    title: (u) => u.title,
    role: (u) => tRole(u.role),
    status: (u) => (u.isActive ? 0 : 1),
  });

  if (users.length === 0) return <p className="rounded-lg border bg-card p-6 text-muted-foreground">{to("noPeople")}</p>;

  return (
    <div className={cn("overflow-x-auto rounded-lg border bg-card", CARD_FRAME)}>
      <table aria-label={to("tabs.people")} className={cn("w-full border-collapse", CARD_TABLE, TABLE_EDGE_PADDING)}>
        <thead>
          <tr className="border-b text-xs font-medium text-muted-foreground">
            {COLUMNS.map((c) => (
              <SortableHead key={c} {...sort.head(c)} className={cn("h-10 text-left font-medium whitespace-nowrap", c === "name" ? "px-4" : "px-3")}>
                {t(`columns.${c}`)}
              </SortableHead>
            ))}
          </tr>
        </thead>
        <tbody>
          {sort.apply(sorted).map((u) => {
            const href = `/people/${u.id}?from=office`;
            return (
              <tr
                key={u.id}
                onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest("a")) return;
                  router.push(href);
                }}
                className={cn(
                  "h-11 cursor-pointer border-b hover:bg-muted/50 md:last:border-b-0",
                  "max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1",
                  CARD_ROW,
                  !u.isActive && "text-muted-foreground",
                )}
              >
                <th scope="row" className="min-w-0 text-left font-medium max-md:col-span-2 md:px-4">
                  <Link href={href} className="group/name flex min-h-9 items-center gap-3 rounded-md hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <Avatar size="sm">
                      {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{initials(u.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate underline-offset-4 group-hover/name:underline">{u.fullName}</span>
                  </Link>
                </th>
                <td className="text-sm max-md:col-span-2 max-md:truncate md:max-w-64 md:truncate md:px-3">{u.title || <span className="text-muted-foreground">—</span>}</td>
                <td className="text-sm md:px-3">{tRole(u.role)}</td>
                <td className="text-sm max-md:justify-self-end md:px-3">{u.isActive ? tc("active") : tc("archived")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
