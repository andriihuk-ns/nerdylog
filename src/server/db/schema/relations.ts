import { relations } from "drizzle-orm";
import { dailyCheckins } from "./daily-checkins";
import { dailyPings } from "./daily-pings";
import { companyHolidays } from "./company-holidays";
import { offices } from "./offices";
import { projectMembers } from "./project-members";
import { projectPrompts } from "./project-prompts";
import { projects } from "./projects";
import { slackSubmissions } from "./slack-submissions";
import { timeEntries } from "./time-entries";
import { users } from "./users";

export const usersRelations = relations(users, ({ many, one }) => ({
  office: one(offices, { fields: [users.officeId], references: [offices.id] }),
  projectMembers: many(projectMembers),
  timeEntries: many(timeEntries),
  dailyCheckins: many(dailyCheckins),
  slackSubmissions: many(slackSubmissions),
  dailyPings: many(dailyPings),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  timeEntries: many(timeEntries),
  members: many(projectMembers),
  prompts: many(projectPrompts),
  creator: one(users, { fields: [projects.createdBy], references: [users.id] }),
  promptOffice: one(offices, { fields: [projects.statusPromptOfficeId], references: [offices.id] }),
}));

export const projectPromptsRelations = relations(projectPrompts, ({ one }) => ({
  project: one(projects, { fields: [projectPrompts.projectId], references: [projects.id] }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const officesRelations = relations(offices, ({ many }) => ({
  users: many(users),
  holidays: many(companyHolidays),
  promptProjects: many(projects),
}));

export const companyHolidaysRelations = relations(companyHolidays, ({ one }) => ({
  office: one(offices, { fields: [companyHolidays.officeId], references: [offices.id] }),
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
