import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DirectoryUser, OfficeView } from "@/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/components/lib/format";

/** People page header: avatar, name, title, office, role, email; back to Team or Directory. */
export function PersonHeader({ user, office, from }: { user: DirectoryUser; office: OfficeView | undefined; from: "team" | "directory" }) {
  const t = useTranslations("people");
  const tRole = useTranslations("roles");
  const tc = useTranslations("common");
  const facts = [
    { label: t("office"), value: office ? `${office.code} · ${office.name}` : t("noOffice") },
    { label: t("role"), value: tRole(user.role) },
    { label: t("status"), value: user.isActive ? tc("active") : tc("archived") },
  ];
  return (
    <header className="flex flex-col gap-4">
      <Link
        href={from === "directory" ? "/admin?tab=directory" : "/team"}
        className="hit-target inline-flex w-fit items-center gap-1 rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {from === "directory" ? t("backDirectory") : t("backTeam")}
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-14">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl">{user.fullName}</h1>
          <p className="text-muted-foreground">
            {[user.title, user.email].filter(Boolean).join(" · ") || t("noTitle")}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 sm:ml-auto">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col">
              <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
