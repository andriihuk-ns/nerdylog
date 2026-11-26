import "server-only";
import { after } from "next/server";
import { serverEnv } from "@/lib/env";
import { listHolidays } from "@/server/services/holiday-service";
import { claimMorningPings } from "@/server/services/ping-service";
import { listProjects } from "@/server/services/project-service";
import { getPtoBalance } from "@/server/services/pto-service";
import { getProjectCapUsage } from "@/server/services/rollup-service";
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
    listHolidays,
    submit: submitSlackSubmission,
    listWeekEntries,
    getProjectCapUsage,
    getPtoBalance,
    claimMorningPings,
  };
}

export function createSlackDeps(): SlackDeps {
  const env = serverEnv();
  return {
    slack: createSlackApi(),
    tempo: createTempoPorts(),
    appBaseUrl: env.APP_BASE_URL.replace(/\/+$/, ""),
    standupChannelId: env.SLACK_STANDUP_CHANNEL_ID || null,
    now: () => new Date(),
    defer: (task) => after(task),
  };
}
