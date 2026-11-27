import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireActor } from "@/server/auth/session";
import { listDirectory } from "@/server/services/directory-service";
import { listHolidays } from "@/server/services/holiday-service";
import { listOffices } from "@/server/services/office-service";
import { todayIn } from "@/components/lib/dates";
import { getCurrentProfile } from "@/components/shell/profile";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { parseOfficeTab } from "@/components/admin/admin-tab";
import { HolidaysPanel } from "@/components/admin/holidays-panel";
import { OfficeDetailPanel } from "@/components/admin/office-detail-panel";
import { OfficePeople } from "@/components/admin/office-people";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("admin") };
}

type Params = Promise<{ officeId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseYear(value: unknown, fallback: number): number {
  const n = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return n >= 2000 && n <= 2100 ? n : fallback;
}

export default async function OfficeDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <NoAccessPanel area="admin" />;

  const [{ officeId }, query, profile] = await Promise.all([params, searchParams, getCurrentProfile()]);
  const [offices, users] = await Promise.all([listOffices(actor), listDirectory(actor)]);
  const office = offices.find((item) => item.id === officeId);
  if (!office) notFound();

  const currentYear = Number(todayIn(profile.timezone).slice(0, 4));
  const year = parseYear(query.year, currentYear);
  const holidays = await listHolidays(actor, year, office.id);

  return (
    <OfficeDetailPanel
      office={office}
      tab={parseOfficeTab(query.tab)}
      year={year}
      panels={{
        people: <OfficePeople users={users.filter((u) => u.officeId === office.id)} />,
        holidays: <HolidaysPanel key={year} office={office} holidays={holidays} year={year} currentYear={currentYear} />,
      }}
    />
  );
}
