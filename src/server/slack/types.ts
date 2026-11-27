import type { ViewsOpenArguments } from "@slack/web-api";
import type {
  Actor,
  HolidayView,
  IsoDate,
  ProjectHours,
  ProjectPromptTarget,
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
  /** chat.postMessage; returns the message ts. `unfurl` (A17) sets unfurl_links + unfurl_media. */
  postMessage(channel: string, text: string, blocks: SlackBlock[], options?: PostOptions): Promise<string | null>;
  /** chat.postEphemeral: a message only `slackUserId` sees in `channel`. */
  postEphemeral(channel: string, slackUserId: string, text: string, blocks?: SlackBlock[]): Promise<void>;
  /** conversations.open for a DM (failure notices); returns the channel id. */
  openDm(slackUserId: string): Promise<string>;
  /** conversations.info → channel name without "#"; null on any error or timeout. Never throws. */
  channelName(channelId: string): Promise<string | null>;
}

export interface PostOptions {
  /** A17: let Slack (and installed apps: Jira, Figma, Asana, Drive) unfurl links in the post. */
  unfurl?: boolean;
}

/** Tempo service calls the Slack layer needs (all writes go through src/server/services). */
export interface TempoPorts {
  resolveUser(slackUserId: string): Promise<SlackActorProfile | null>;
  /** A15: every project; `isMember` marks the ones the actor may log time to. */
  listProjects(actor: Actor): Promise<ProjectView[]>;
  /** Holiday names for App Home (all offices); dates come from listHolidayDates. */
  listHolidays(actor: Actor, year: number): Promise<HolidayView[]>;
  /** A15: holiday dates of the user's own office in [from, to]; no office → []. */
  listHolidayDates(userId: string, from: IsoDate, to: IsoDate): Promise<IsoDate[]>;
  submit(input: SlackSubmissionInput): Promise<SubmitSlackSubmissionResult>;
  listWeekEntries(actor: Actor, userId: string, weekStart: IsoDate): Promise<TimeEntryView[]>;
  /** A15: the actor's hours per project in the month. */
  getProjectHours(actor: Actor, month: string): Promise<ProjectHours[]>;
  getPtoBalance(actor: Actor, userId: string, year: number): Promise<PtoBalance>;
  /** A16: claim the projects whose channel status prompt is due now (project_prompts dedup). */
  claimProjectPrompts(now: Date): Promise<ProjectPromptTarget[]>;
  /** A11/A15: the general standup channel; null → no card. */
  getStandupChannelId(): Promise<string | null>;
  /** A11: active projects that have a Slack channel. */
  listProjectChannels(): Promise<ProjectChannel[]>;
  /** A11: store the standup card's ts on daily_checkins (no row → no-op). */
  setCheckinChannelTs(userId: string, checkinDate: IsoDate, ts: string): Promise<void>;
}

export interface ProjectChannel {
  projectId: string;
  projectName: string;
  slackChannelId: string;
}

export interface SlackDeps {
  slack: SlackApi;
  tempo: TempoPorts;
  appBaseUrl: string;
  now(): Date;
  /** Runs work after the HTTP response (next/server `after` in production). */
  defer(task: () => Promise<void>): void;
}
