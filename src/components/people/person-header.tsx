import Link from "next/link";
import {
  BriefcaseBusiness,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Mail,
  MapPin,
  Shield,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { DirectoryUser, OfficeView } from "@/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/components/lib/format";

/** People page header: identity and icon-led metadata; back to Team or Directory. */
export function PersonHeader({ user, office, from }: { user: DirectoryUser; office: OfficeView | undefined; from: "team" | "directory" }) {
  const t = useTranslations("people");
  const tRole = useTranslations("roles");
  const tc = useTranslations("common");
  const officeValue = office ? `${office.code} · ${office.name}` : t("noOffice");
  const statusValue = user.isActive ? tc("active") : tc("archived");
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
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl">{user.fullName}</h1>
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("position")}</dt>
              <dd className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness aria-hidden className="size-4 shrink-0" />
                {user.title || t("noTitle")}
              </dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("email")}</dt>
              <dd>
                <a
                  href={`mailto:${user.email}`}
                  className="inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Mail aria-hidden className="size-4 shrink-0" />
                  {user.email}
                </a>
              </dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("office")}</dt>
              <dd className="inline-flex items-center gap-1.5" aria-label={`${t("office")}: ${officeValue}`}>
                <MapPin aria-hidden className="size-4 shrink-0" />
                {officeValue}
              </dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("role")}</dt>
              <dd className="inline-flex items-center gap-1.5" aria-label={`${t("role")}: ${tRole(user.role)}`}>
                <Shield aria-hidden className="size-4 shrink-0" />
                {tRole(user.role)}
              </dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("status")}</dt>
              <dd className="inline-flex items-center gap-1.5" aria-label={`${t("status")}: ${statusValue}`}>
                {user.isActive ? (
                  <CircleCheck aria-hidden className="size-4 shrink-0 text-work" />
                ) : (
                  <CircleX aria-hidden className="size-4 shrink-0" />
                )}
                {statusValue}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </header>
  );
}
