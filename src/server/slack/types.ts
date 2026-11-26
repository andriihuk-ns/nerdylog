import type { ViewsOpenArguments } from "@slack/web-api";
import type {
  Actor,
  HolidayView,
  IsoDate,
  PingTarget,
  ProjectCapUsage,
  ProjectView,
  PtoBalance,
  SlackActorProfile,
  SlackSubmissionInput,
  SubmitSlackSubmissionResult,
  TimeEntryView,
} from "@/contracts";

/** Block Kit view types, derived from @slack/web-api so we need no extra dependency. */
export type SlackView = ViewsOpenArguments["view"];
export type ModalView = Extract<SlackView, { type: "modal" }>;
export type HomeView = Extract<SlackView, { type: "home" }>;
export type SlackBlock = ModalView["blocks"][number];

/** A Tempo user resolved from a Slack user id (contract: GetActorBySlackUserId). */
export type { SlackActorProfile } from "@/contracts";

/** Thin port over the Slack Web API so handlers are unit-testable without network. */
export interface SlackApi {
  /** views.open; returns the new view id. Must be called within 3 s of the trigger. */
  openView(triggerId: string, view: ModalView): Promise<string>;
  updateView(viewId: string, view: ModalView, hash?: string): Promise<void>;
  publishHome(slackUserId: string, view: HomeView): Promise<void>;
  /** chat.postMessage; returns the message ts. */
  postMessage(channel: string, text: string, blocks: SlackBlock[]): Promise<string | null>;
  /** conversations.open for a DM; returns the channel id. */
  openDm(slackUserId: string): Promise<string>;
}

/** Tempo service calls the Slack layer needs (all writes go through src/server/services). */
export interface TempoPorts {
  resolveUser(slackUserId: string): Promise<SlackActorProfile | null>;
  listProjects(actor: Actor): Promise<ProjectView[]>;
  listHolidays(actor: Actor, year: number): Promise<HolidayView[]>;
  submit(input: SlackSubmissionInput): Promise<SubmitSlackSubmissionResult>;
  listWeekEntries(actor: Actor, userId: string, weekStart: IsoDate): Promise<TimeEntryView[]>;
  getProjectCapUsage(actor: Actor, month: string): Promise<ProjectCapUsage[]>;
  getPtoBalance(actor: Actor, userId: string, year: number): Promise<PtoBalance>;
  claimMorningPings(now: Date): Promise<PingTarget[]>;
}

export interface SlackDeps {
  slack: SlackApi;
  tempo: TempoPorts;
  appBaseUrl: string;
  standupChannelId: string | null;
  now(): Date;
  /** Runs work after the HTTP response (next/server `after` in production). */
  defer(task: () => Promise<void>): void;
}
