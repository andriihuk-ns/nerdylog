import "server-only";
import { after } from "next/server";
import { serverEnv } from "@/lib/env";
import { listHolidayDatesForUser, listHolidays } from "@/server/services/holiday-service";
import { claimMorningPings } from "@/server/services/ping-service";
import { listProjects } from "@/server/services/project-service";
import { getPtoBalance } from "@/server/services/pto-service";
import { getProjectHours } from "@/server/services/rollup-service";
import { setCheckinChannelTs } from "@/server/services/checkin-service";
import { getStandupChannelId, listProjectChannels } from "@/server/services/settings-service";
import { submitSlackSubmission } from "@/server/services/standup-service";
import { listWeekEntries } from "@/server/services/time-entry-service";
// Contract request (services.ts): GetActorBySlackUserId → SlackActorProfile | null, active users only.
import { getActorBySlackUserId } from "@/server/services/user-service";
import { createSlackApi } from "./slack-api";
import type { SlackDeps, TempoPorts } from "./types";

/** Production wiring of the Slack layer to Tempo services (all writes go through services). */
export function createTempoPorts(): TempoPorts {
  return {
    resolveUser: getActorBySlackUserId,
    listProjects: (actor) => listProjects(actor),
    listHolidays: (actor, year) => listHolidays(actor, year),
    listHolidayDates: listHolidayDatesForUser, // A15: the user's own-office holidays
    submit: submitSlackSubmission,
    listWeekEntries,
    getProjectHours: (actor, month) => getProjectHours(actor, month),
    getPtoBalance,
    claimMorningPings,
    getStandupChannelId,
    listProjectChannels,
    setCheckinChannelTs,
  };
}

export function createSlackDeps(): SlackDeps {
  const env = serverEnv();
  return {
    slack: createSlackApi(),
    tempo: createTempoPorts(),
    appBaseUrl: env.APP_BASE_URL.replace(/\/+$/, ""),
    now: () => new Date(),
    defer: (task) => after(task),
  };
}
