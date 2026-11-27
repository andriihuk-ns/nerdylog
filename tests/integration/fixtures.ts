/**
 * Minimal, anonymised seed helpers for *.db.test.ts. Call them inside `withRollback` only.
 * No real names, emails or Slack ids: every value is synthetic.
 */
import { randomUUID } from "node:crypto";
import type { EntryType, Role } from "@/contracts";
import type { Tx } from "@/server/db/queries/types";
import { companyHolidays, offices, projectMembers, projects, timeEntries, users } from "@/server/db/schema";

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
  officeId?: string | null;
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
      officeId: opts.officeId ?? null,
    })
    .returning({ id: users.id });
  return { id: row.id, authUserId, role, slackUserId };
}

export async function seedProject(
  tx: Tx,
  opts: {
    name?: string;
    isActive?: boolean;
    slackChannelId?: string | null;
    members?: readonly string[];
    statusPromptTime?: string; // A16
    statusPromptOfficeId?: string | null; // A16
  } = {},
): Promise<string> {
  const [row] = await tx
    .insert(projects)
    .values({
      name: opts.name ?? `Test Project ${next()}`,
      isActive: opts.isActive ?? true,
      slackChannelId: opts.slackChannelId ?? null,
      statusPromptTime: opts.statusPromptTime,
      statusPromptOfficeId: opts.statusPromptOfficeId ?? null,
    })
    .returning({ id: projects.id });
  if (opts.members?.length) await seedProjectMembers(tx, row.id, opts.members);
  return row.id;
}

/** A15: cache users as members of a project (only members may log work to it). */
export async function seedProjectMembers(tx: Tx, projectId: string, userIds: readonly string[]): Promise<void> {
  await tx.insert(projectMembers).values(userIds.map((userId) => ({ projectId, userId })));
}

/** A15: a synthetic office (codes never collide with the real UA / PL rows). A16: with an IANA timezone. */
export async function seedOffice(tx: Tx, name = "Test Office", timezone = "Europe/Kyiv"): Promise<string> {
  const [row] = await tx.insert(offices).values({ code: `T${next()}`, name, timezone }).returning({ id: offices.id });
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

export async function seedHoliday(tx: Tx, officeId: string, date: string, name = "Test Holiday"): Promise<void> {
  await tx.insert(companyHolidays).values({ officeId, holidayDate: date, name });
}

/** Actor shape for service calls (services trust the actor; requireActor resolves it in prod). */
export const actorOf = (u: SeededUser) => ({ userId: u.id, role: u.role });
