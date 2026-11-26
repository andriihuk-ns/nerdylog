import { relations } from "drizzle-orm";
import { dailyCheckins } from "./daily-checkins";
import { dailyPings } from "./daily-pings";
import { projects } from "./projects";
import { slackSubmissions } from "./slack-submissions";
import { teamMembers, teams } from "./teams";
import { timeEntries } from "./time-entries";
import { users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  timeEntries: many(timeEntries),
  dailyCheckins: many(dailyCheckins),
  slackSubmissions: many(slackSubmissions),
  dailyPings: many(dailyPings),
  teamMembers: many(teamMembers),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  timeEntries: many(timeEntries),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(users, { fields: [timeEntries.userId], references: [users.id] }),
  project: one(projects, { fields: [timeEntries.projectId], references: [projects.id] }),
}));

export const dailyCheckinsRelations = relations(dailyCheckins, ({ one }) => ({
  user: one(users, { fields: [dailyCheckins.userId], references: [users.id] }),
}));

export const slackSubmissionsRelations = relations(slackSubmissions, ({ one }) => ({
  user: one(users, { fields: [slackSubmissions.userId], references: [users.id] }),
}));

export const dailyPingsRelations = relations(dailyPings, ({ one }) => ({
  user: one(users, { fields: [dailyPings.userId], references: [users.id] }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));
