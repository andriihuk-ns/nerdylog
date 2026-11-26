import { vi } from "vitest";
import type { ProjectView, PtoBalance } from "@/contracts";
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
};

export const project: ProjectView = {
  id: PROJECT_ID,
  name: "DogTeamPro",
  code: "DTP",
  monthlyHourCap: 40,
  isBillable: true,
  isActive: true,
  slackChannelId: "C_DTP",
};

export const OTHER_PROJECT_ID = "2b3c4d5e-8f1e-4c1b-9a35-3b1f8f0f6a04";
export const otherProject: ProjectView = {
  id: OTHER_PROJECT_ID,
  name: "Changelly",
  code: "CNG",
  monthlyHourCap: null,
  isBillable: true,
  isActive: true,
  slackChannelId: "C_CNG",
};

export const ptoBalance: PtoBalance = {
  userId: USER_ID,
  year: 2026,
  allowanceDays: 20,
  vacationUsedDays: 8,
  sickUsedDays: 2,
  remainingDays: 12,
};

export function fakeDeps(over: Partial<SlackDeps> = {}) {
  const tasks: Array<() => Promise<void>> = [];
  const slack = {
    openView: vi.fn(async () => "V_LOADING"),
    updateView: vi.fn(async () => undefined),
    publishHome: vi.fn(async () => undefined),
    postMessage: vi.fn(async () => "1700000000.000100"),
    openDm: vi.fn(async (id: string) => `D_${id}`),
  };
  const tempo = {
    resolveUser: vi.fn(async (id: string) => (id === profile.slackUserId ? profile : null)),
    listProjects: vi.fn(async () => [project, otherProject]),
    listHolidays: vi.fn(async () => [{ id: "h1", holidayDate: "2026-12-25", name: "Christmas" }]),
    submit: vi.fn(async () => ({ status: "created" as const, entryIds: ["e1"] })),
    listWeekEntries: vi.fn(async () => []),
    getProjectCapUsage: vi.fn(async () => []),
    getPtoBalance: vi.fn(async () => ptoBalance),
    claimMorningPings: vi.fn(async () => []),
    getStandupChannelId: vi.fn(async (): Promise<string | null> => "C_STANDUP"),
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
