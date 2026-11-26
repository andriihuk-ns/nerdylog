/**
 * Minimal, anonymised seed helpers for *.db.test.ts. Call them inside `withRollback` only.
 * No real names, emails or Slack ids: every value is synthetic.
 */
import { randomUUID } from "node:crypto";
import type { EntryType, Role } from "@/contracts";
import type { Tx } from "@/server/db/queries/types";
import { companyHolidays, projects, timeEntries, users } from "@/server/db/schema";

let seq = 0;
const next = () => `${Date.now().toString(36)}${(seq++).toString(36)}`.toUpperCase();

export interface SeedUserOpts {
  fullName?: string;
  role?: Role;
  timezone?: string;
  dailyNormHours?: number;
  ptoAllowanceDays?: number | null;
  isActive?: boolean;
  withAuth?: boolean;
}

export interface SeededUser {
  id: string;
  authUserId: string | null;
  role: Role;
  slackUserId: string;
}

export async function seedUser(tx: Tx, opts: SeedUserOpts = {}): Promise<SeededUser> {
  const role = opts.role ?? "member";
  const slackUserId = `UTEST${next()}`;
  const authUserId = opts.withAuth === false ? null : randomUUID();
  const [row] = await tx
    .insert(users)
    .values({
      slackUserId,
      authUserId,
      fullName: opts.fullName ?? `Test ${role} ${slackUserId}`,
      email: `${slackUserId.toLowerCase()}@example.test`,
      role,
      timezone: opts.timezone ?? "Europe/Kyiv",
      dailyNormHours: opts.dailyNormHours ?? 8,
      ptoAllowanceDays: opts.ptoAllowanceDays ?? null,
      isActive: opts.isActive ?? true,
    })
    .returning({ id: users.id });
  return { id: row.id, authUserId, role, slackUserId };
}

export async function seedProject(
  tx: Tx,
  opts: { name?: string; cap?: number | null; isActive?: boolean; slackChannelId?: string | null } = {},
): Promise<string> {
  const code = `T${next()}`;
  const [row] = await tx
    .insert(projects)
    .values({
      name: opts.name ?? `Test Project ${code}`,
      code,
      monthlyHourCap: opts.cap ?? null,
      isActive: opts.isActive ?? true,
      slackChannelId: opts.slackChannelId ?? null,
    })
    .returning({ id: projects.id });
  return row.id;
}

export interface SeedEntry {
  userId: string;
  date: string;
  type?: EntryType;
  hours?: number;
  projectId?: string | null;
  summary?: string;
}

export async function seedEntries(tx: Tx, rows: readonly SeedEntry[]): Promise<string[]> {
  if (rows.length === 0) return [];
  const inserted = await tx
    .insert(timeEntries)
    .values(
      rows.map((r) => ({
        userId: r.userId,
        projectId: r.projectId ?? null,
        workDate: r.date,
        hours: r.hours ?? 0,
        entryType: r.type ?? "work",
        taskSummary: r.summary ?? "",
        source: "web_ui" as const,
      })),
    )
    .returning({ id: timeEntries.id });
  return inserted.map((r) => r.id);
}

export async function seedHoliday(tx: Tx, date: string, name = "Test Holiday"): Promise<void> {
  await tx.insert(companyHolidays).values({ holidayDate: date, name });
}

/** Actor shape for service calls (services trust the actor; requireActor resolves it in prod). */
export const actorOf = (u: SeededUser) => ({ userId: u.id, role: u.role });
