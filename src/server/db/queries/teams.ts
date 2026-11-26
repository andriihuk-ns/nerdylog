import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { TeamView } from "@/contracts";
import { teamMembers, teams, users, type TeamInsert } from "../schema";
import type { DbOrTx } from "./types";

/**
 * Amendment A13 queries. Member ids are loaded with a second query and grouped in JS rather than
 * `array_agg(uuid)`: the client runs with `fetch_types: false`, so uuid[] would not be parsed.
 */

const teamColumns = {
  id: teams.id,
  slackUsergroupId: teams.slackUsergroupId,
  handle: teams.handle,
  name: teams.name,
  slackChannelId: teams.slackChannelId,
  isActive: teams.isActive,
};

type TeamRow = Omit<TeamView, "memberIds">;

/** team id → sorted member user ids. */
async function memberIdsByTeam(db: DbOrTx, teamIds: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (teamIds.length === 0) return out;
  const rows = await db
    .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, [...teamIds]))
    .orderBy(asc(teamMembers.teamId), asc(teamMembers.userId));
  for (const r of rows) {
    const list = out.get(r.teamId);
    if (list) list.push(r.userId);
    else out.set(r.teamId, [r.userId]);
  }
  return out;
}

async function withMembers(db: DbOrTx, rows: TeamRow[]): Promise<TeamView[]> {
  const members = await memberIdsByTeam(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({ ...r, memberIds: members.get(r.id) ?? [] }));
}

/** Teams by name (active only unless asked), each with its member ids. */
export async function listTeamViews(db: DbOrTx, includeArchived: boolean): Promise<TeamView[]> {
  const query = db.select(teamColumns).from(teams);
  const rows = await (includeArchived ? query : query.where(eq(teams.isActive, true))).orderBy(
    asc(teams.name),
    asc(teams.id),
  );
  return withMembers(db, rows);
}

/** Sets (or clears) the admin-chosen channel. Returns the team, or undefined when no such id. */
export async function updateTeamChannelRow(
  db: DbOrTx,
  teamId: string,
  slackChannelId: string | null,
): Promise<TeamView | undefined> {
  const [row] = await db.update(teams).set({ slackChannelId }).where(eq(teams.id, teamId)).returning(teamColumns);
  if (!row) return undefined;
  const [view] = await withMembers(db, [row]);
  return view;
}

export interface ExistingTeam {
  id: string;
  slackUsergroupId: string;
  handle: string;
  name: string;
  isActive: boolean;
  memberIds: string[];
}

/** Every team (archived included) with member ids, the input for `planTeamSync`. */
export async function listTeamsForSync(db: DbOrTx): Promise<ExistingTeam[]> {
  const rows = await listTeamViews(db, true);
  return rows.map((t) => ({
    id: t.id,
    slackUsergroupId: t.slackUsergroupId,
    handle: t.handle,
    name: t.name,
    isActive: t.isActive,
    memberIds: t.memberIds,
  }));
}

/** Slack user id → Tempo user id, for the Slack ids that exist. */
export async function findUserIdsBySlackIds(
  db: DbOrTx,
  slackUserIds: readonly string[],
): Promise<Map<string, string>> {
  if (slackUserIds.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, slackUserId: users.slackUserId })
    .from(users)
    .where(inArray(users.slackUserId, [...slackUserIds]));
  return new Map(rows.map((r) => [r.slackUserId, r.id]));
}

export type NewTeam = Pick<TeamInsert, "slackUsergroupId" | "handle" | "name" | "isActive">;

/** Inserts one team and returns its id. */
export async function insertTeam(db: DbOrTx, values: NewTeam): Promise<string> {
  const [row] = await db.insert(teams).values(values).returning({ id: teams.id });
  return row.id;
}

export type TeamPatch = Partial<Pick<TeamInsert, "handle" | "name" | "isActive">>;

export async function updateTeamRow(db: DbOrTx, teamId: string, patch: TeamPatch): Promise<void> {
  await db.update(teams).set(patch).where(eq(teams.id, teamId));
}

/** Replaces a team's membership with exactly `userIds`. Run inside a transaction. */
export async function replaceTeamMembers(db: DbOrTx, teamId: string, userIds: readonly string[]): Promise<void> {
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  if (userIds.length === 0) return;
  await db.insert(teamMembers).values(userIds.map((userId) => ({ teamId, userId })));
}

/** A13 routing: distinct channels of the user's active teams that have one, sorted. */
export async function listActiveTeamChannelsForUser(db: DbOrTx, userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ slackChannelId: teams.slackChannelId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, userId), eq(teams.isActive, true), isNotNull(teams.slackChannelId)))
    .orderBy(asc(teams.slackChannelId));
  return rows.flatMap((r) => (r.slackChannelId ? [r.slackChannelId] : []));
}
