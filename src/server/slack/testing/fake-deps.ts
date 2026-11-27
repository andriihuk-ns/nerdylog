import { vi } from "vitest";
import type { ProjectHours, ProjectPromptTarget, ProjectView, PtoBalance } from "@/contracts";
import type { SlackActorProfile, SlackDeps } from "../types";

/** Test-only fakes for SlackDeps. Deferred tasks are collected and run by `flush()`. */
export const USER_ID = "7f0c1a52-8f1e-4c1b-9a35-3b1f8f0f6a01";
export const PROJECT_ID = "1a2b3c4d-8f1e-4c1b-9a35-3b1f8f0f6a03";

export const profile: SlackActorProfile = {
  userId: USER_ID,
  role: "member",
  slackUserId: "U123",
  fullName: "Olena Petrenko",
  avatarUrl: "https://avatars.example/o.png",
  timezone: "Europe/Kyiv",
  locale: "en", // existing tests assert English copy; uk is covered in i18n-specific tests
};

export const project: ProjectView = {
  id: PROJECT_ID,
  name: "DogTeamPro",
  isActive: true,
  slackChannelId: "C_DTP",
  createdBy: { userId: "0b4c6a52-8f1e-4c1b-9a35-3b1f8f0f6a09", fullName: "Andrii Admin" },
  memberIds: [USER_ID],
  memberAllocations: [{ userId: USER_ID, fullName: profile.fullName, avatarUrl: null, allocationHoursPerMonth: 160 }],
  isMember: true,
  statusPromptTime: "10:00",
  statusPromptOfficeId: null,
  hasTimeEntries: true,
};

export const OTHER_PROJECT_ID = "2b3c4d5e-8f1e-4c1b-9a35-3b1f8f0f6a04";
export const otherProject: ProjectView = {
  id: OTHER_PROJECT_ID,
  name: "Changelly",
  isActive: true,
  slackChannelId: "C_CNG",
  createdBy: null,
  memberIds: [USER_ID],
  memberAllocations: [{ userId: USER_ID, fullName: profile.fullName, avatarUrl: null, allocationHoursPerMonth: 160 }],
  isMember: true,
  statusPromptTime: "10:00",
  statusPromptOfficeId: null,
  hasTimeEntries: true,
};

/** A15: a project the test user is NOT a member of (hidden from modals, rejected on submit). */
export const FOREIGN_PROJECT_ID = "3c4d5e6f-8f1e-4c1b-9a35-3b1f8f0f6a05";
export const foreignProject: ProjectView = {
  id: FOREIGN_PROJECT_ID,
  name: "Swapzone",
  isActive: true,
  slackChannelId: "C_SWZ",
  createdBy: { userId: "0b4c6a52-8f1e-4c1b-9a35-3b1f8f0f6a09", fullName: "Andrii Admin" },
  memberIds: [],
  memberAllocations: [],
  isMember: false,
  statusPromptTime: "10:00",
  statusPromptOfficeId: null,
  hasTimeEntries: false,
};

export const ptoBalance: PtoBalance = {
  userId: USER_ID,
  year: 2026,
  allowanceDays: 20,
  sickAllowanceDays: 5,
  vacationUsedDays: 8,
  sickUsedDays: 2,
  remainingDays: 12,
  sickRemainingDays: 3,
};

export function fakeDeps(over: Partial<SlackDeps> = {}) {
  const tasks: Array<() => Promise<void>> = [];
  const slack = {
    openView: vi.fn(async () => "V_LOADING"),
    updateView: vi.fn(async () => undefined),
    publishHome: vi.fn(async () => undefined),
    postMessage: vi.fn(async () => "1700000000.000100"),
    postEphemeral: vi.fn<(channel: string, user: string, text: string) => Promise<void>>(async () => undefined),
    openDm: vi.fn(async (id: string) => `D_${id}`),
    channelName: vi.fn<(channelId: string) => Promise<string | null>>(async (id: string) => id.replace(/^C_/, "").toLowerCase()),
  };
  const tempo = {
    resolveUser: vi.fn(async (id: string) => (id === profile.slackUserId ? profile : null)),
    listProjects: vi.fn(async () => [project, otherProject, foreignProject]),
    listHolidays: vi.fn(async () => [{ id: "h1", officeId: "office-ua", holidayDate: "2026-12-25", name: "Christmas" }]),
    listHolidayDates: vi.fn<(userId: string, from: string, to: string) => Promise<string[]>>(async (_u, from, to) =>
      ["2026-12-25"].filter((d) => d >= from && d <= to),
    ),
    submit: vi.fn(async () => ({ status: "created" as const, entryIds: ["e1"] })),
    listWeekEntries: vi.fn(async () => []),
    getProjectHours: vi.fn(async () => [] as ProjectHours[]),
    getPtoBalance: vi.fn(async () => ptoBalance),
    claimMorningReminders: vi.fn(async () => []),
    claimProjectPrompts: vi.fn<(now: Date) => Promise<ProjectPromptTarget[]>>(async () => []),
    getStandupChannelId: vi.fn<() => Promise<string | null>>(async () => "C_STANDUP"),
    listProjectChannels: vi.fn(async () =>
      [project, otherProject].map((p) => ({ projectId: p.id, projectName: p.name, slackChannelId: p.slackChannelId! })),
    ),
    setCheckinChannelTs: vi.fn(async () => undefined),
  };
  const deps = {
    slack,
    tempo,
    appBaseUrl: "https://tempo.example",
    now: () => new Date("2026-11-26T08:00:00Z"), // Thursday 10:00 in Kyiv
    defer: (task: () => Promise<void>) => {
      tasks.push(task);
    },
    ...over,
  } satisfies SlackDeps;
  const flush = async () => {
    while (tasks.length > 0) await tasks.shift()!();
  };
  return { deps, slack, tempo, tasks, flush };
}
