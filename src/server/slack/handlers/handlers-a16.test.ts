import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectPromptTarget, SlackSubmissionInput } from "@/contracts";
import { buildProjectPrompt, decodePromptValue } from "../blocks/project-prompt";
import { buildStandupCard } from "../blocks/standup-card";
import { ACTION, BLOCK, CALLBACK, INPUT_ACTION, rowBlock } from "../ids";
import { encodeMetadata } from "../metadata";
import {
  fakeDeps,
  FOREIGN_PROJECT_ID,
  foreignProject,
  OTHER_PROJECT_ID,
  profile,
  PROJECT_ID,
  USER_ID,
} from "../testing/fake-deps";
import { handleInteraction } from "./interactions";
import { PRECHECK_BUDGET_MS, runProjectPrompts } from "./project-prompt";
import { routeSubmission } from "./submit";

type Json = Record<string, unknown>;
const payload = (p: unknown) => new URLSearchParams({ payload: JSON.stringify(p) });
const field = (v: object) => ({ [INPUT_ACTION]: v });

const target = (over: Partial<ProjectPromptTarget> = {}): ProjectPromptTarget => ({
  projectId: PROJECT_ID,
  projectName: "DogTeamPro",
  slackChannelId: "C_DTP",
  localDate: "2026-11-26",
  logDate: "2026-11-25",
  recipients: [{ slackUserId: "U123", locale: "en" }],
  ...over,
});

const click = (projectId: string, user = "U123", logDate = "2026-11-24") =>
  payload({
    type: "block_actions",
    trigger_id: "T_PROMPT",
    user: { id: user },
    channel: { id: "C_DTP" },
    container: { type: "message", channel_id: "C_DTP" },
    actions: [{ action_id: ACTION.projectStatusOpen, value: JSON.stringify({ projectId, logDate }) }],
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("A16 project status prompt (cron)", () => {
  it("A31: sends each project's prompt privately: ephemeral in the channel only, never a public post or DM", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.claimProjectPrompts.mockResolvedValueOnce([target(), target({ projectId: OTHER_PROJECT_ID, projectName: "Changelly", slackChannelId: "C_CNG" })]);
    expect(await runProjectPrompts(deps)).toEqual({ claimed: 2, posted: 2, failed: 0 });
    expect(tempo.claimProjectPrompts).toHaveBeenCalledWith(deps.now());
    expect(slack.postEphemeral.mock.calls.map((c) => [c[0], c[1]])).toEqual([["C_DTP", "U123"], ["C_CNG", "U123"]]);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(tempo.resolveUser).not.toHaveBeenCalled(); // recipients come with the target, no per-user lookup

    const [, , text, blocks] = slack.postEphemeral.mock.calls[0] as unknown as [string, string, string, Json[]];
    expect(text).toMatch(/^📝 Daily status · DogTeamPro: How did Wednesday.*25 November go\?/);
    expect(blocks.map((b) => b.type)).toEqual(["header", "section", "actions"]);
    expect((blocks[0].text as Json).text).toBe("📝 Daily status · DogTeamPro");
    const [button] = (blocks[2] as { elements: Json[] }).elements;
    expect(button).toMatchObject({ type: "button", action_id: ACTION.projectStatusOpen, style: "primary", text: { text: "Log time" } });
    expect(JSON.parse(button.value as string)).toEqual({ projectId: PROJECT_ID, logDate: "2026-11-25" });
  });

  it("continues past a project nobody could be reached for and counts it", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tempo.claimProjectPrompts.mockResolvedValueOnce([target({ slackChannelId: "C_GONE" }), target()]);
    slack.postEphemeral.mockRejectedValueOnce(new Error("not_in_channel"));
    slack.postMessage.mockRejectedValueOnce(new Error("cannot_dm"));
    expect(await runProjectPrompts(deps)).toEqual({ claimed: 2, posted: 1, failed: 1 });
    expect(errors).toHaveBeenCalledWith("cron/morning-ping: project prompt failed", "C_GONE", "cannot_dm");
    errors.mockRestore();
  });

  it("A32: each recipient gets the prompt in their own locale", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.claimProjectPrompts.mockResolvedValueOnce([
      target({ recipients: [{ slackUserId: "U123", locale: "en" }, { slackUserId: "U456", locale: "uk" }] }),
    ]);
    await runProjectPrompts(deps);
    const byUser = new Map(slack.postEphemeral.mock.calls.map((c) => [c[1], c[2]]));
    expect(byUser.get("U123")).toContain("Daily status");
    expect(byUser.get("U456")).toContain("Щоденний статус");
  });

  it("A33: a refused ephemeral falls back to a DM; a project without members counts as failed", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tempo.claimProjectPrompts.mockResolvedValueOnce([target(), target({ recipients: [] })]);
    slack.postEphemeral.mockRejectedValueOnce(new Error("user_not_in_channel"));
    expect(await runProjectPrompts(deps)).toEqual({ claimed: 2, posted: 1, failed: 1 });
    expect(slack.postMessage.mock.calls.map((c) => (c as unknown[])[0])).toEqual(["D_U123"]);
    errors.mockRestore();
  });

  it("nothing claimed → nothing posted", async () => {
    const { deps, slack } = fakeDeps();
    expect(await runProjectPrompts(deps)).toEqual({ claimed: 0, posted: 0, failed: 0 });
    expect(slack.postMessage).not.toHaveBeenCalled();
  });

  it("button value round-trips; malformed values are rejected", () => {
    const msg = buildProjectPrompt({ projectId: PROJECT_ID, projectName: "X", logDate: "2026-11-25", locale: "en" });
    const value = ((msg.blocks[2] as unknown as { elements: Json[] }).elements[0].value as string);
    expect(decodePromptValue(value)).toEqual({ projectId: PROJECT_ID, logDate: "2026-11-25" });
    expect(decodePromptValue("2026-11-25")).toBeNull();
    expect(decodePromptValue(JSON.stringify({ projectId: PROJECT_ID, logDate: "soon" }))).toBeNull();
  });

  it("keeps personal reminders separate from project-channel prompts", () => {
    expect("claimMorningPings" in fakeDeps().tempo).toBe(false);
    expect("claimMorningReminders" in fakeDeps().tempo).toBe(true);
  });
});

describe("A16 'Log time & status' button", () => {
  it("member: opens the standup modal fast with the project preselected and the prompt's date, in the clicker's locale", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    tempo.resolveUser.mockResolvedValue({ ...profile, locale: "uk" });
    const res = await handleInteraction(click(OTHER_PROJECT_ID), deps);
    expect(res.status).toBe(200);
    expect(slack.openView).toHaveBeenCalledWith("T_PROMPT", expect.objectContaining({ callback_id: CALLBACK.loading }));
    await flush();
    const view = (slack.updateView.mock.calls[0] as unknown[])[1] as { callback_id: string; private_metadata: string; title: { text: string }; blocks: Json[] };
    expect(view.callback_id).toBe(CALLBACK.time);
    expect(view.title.text).toBe("Щоденний статус");
    expect(JSON.parse(view.private_metadata)).toMatchObject({ kind: "standup", logDate: "2026-11-24", projectId: OTHER_PROJECT_ID, rows: 1 });
    const row1 = view.blocks.find((b) => b.block_id === rowBlock.project(1))!.element as Json;
    expect((row1.initial_option as Json).value).toBe(OTHER_PROJECT_ID);
    expect(slack.postEphemeral).not.toHaveBeenCalled();
  });

  it("non-member: ephemeral 'Ask {creator}' in the channel, no modal", async () => {
    const { deps, slack, flush } = fakeDeps();
    await handleInteraction(click(FOREIGN_PROJECT_ID), deps);
    expect(slack.openView).not.toHaveBeenCalled();
    await flush();
    expect(slack.postEphemeral).toHaveBeenCalledWith("C_DTP", "U123", "Ask Andrii Admin to add you to this project.");
  });

  it("non-member (uk, unknown creator) gets the Ukrainian ephemeral", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    tempo.resolveUser.mockResolvedValue({ ...profile, locale: "uk" });
    tempo.listProjects.mockResolvedValue([{ ...foreignProject, createdBy: null }]);
    await handleInteraction(click(FOREIGN_PROJECT_ID), deps);
    await flush();
    expect(slack.postEphemeral).toHaveBeenCalledWith("C_DTP", "U123", "Попроси адміна додати тебе до цього проєкту.");
  });

  it("unknown Slack user: ephemeral 'not set up' in Ukrainian (default locale), no modal", async () => {
    const { deps, slack, flush } = fakeDeps();
    await handleInteraction(click(PROJECT_ID, "U_STRANGER"), deps);
    await flush();
    expect(slack.openView).not.toHaveBeenCalled();
    const [channel, user, text] = slack.postEphemeral.mock.calls[0];
    expect([channel, user]).toEqual(["C_DTP", "U_STRANGER"]);
    expect(text).toContain("Тебе ще немає в nerdylog");
  });

  it("slow pre-check: the modal still opens in time and then shows the denial inside it", async () => {
    vi.useFakeTimers();
    const { deps, slack, tempo, flush } = fakeDeps();
    let release!: () => void;
    tempo.resolveUser.mockImplementation(
      (async () => {
        await new Promise<void>((r) => {
          release = r;
        });
        return profile;
      }) as never,
    );
    const pending = handleInteraction(click(FOREIGN_PROJECT_ID), deps);
    await vi.advanceTimersByTimeAsync(PRECHECK_BUDGET_MS);
    expect((await pending).status).toBe(200);
    expect(slack.openView).toHaveBeenCalledWith("T_PROMPT", expect.objectContaining({ callback_id: CALLBACK.loading }));
    release();
    tempo.resolveUser.mockResolvedValue(profile);
    await flush();
    const view = (slack.updateView.mock.calls[0] as unknown[])[1] as { callback_id: string };
    expect(view.callback_id).toBe(CALLBACK.notice);
    expect(JSON.stringify(view)).toContain("Ask Andrii Admin to add you to this project.");
    expect(slack.postEphemeral).not.toHaveBeenCalled();
  });

  it("ignores a malformed button value", async () => {
    const { deps, slack, tasks } = fakeDeps();
    const bad = payload({ type: "block_actions", trigger_id: "T", user: { id: "U123" }, actions: [{ action_id: ACTION.projectStatusOpen, value: "x" }] });
    expect((await handleInteraction(bad, deps)).status).toBe(200);
    expect(slack.openView).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });
});

describe("A16 required inputs (view_submission)", () => {
  const submit = (values: Record<string, object>, rows = 1) =>
    payload({
      type: "view_submission",
      user: { id: "U123" },
      view: {
        id: "V_REQ",
        callback_id: CALLBACK.time,
        private_metadata: encodeMetadata({ kind: "standup", logDate: "2026-11-25", userId: USER_ID, today: "2026-11-26", rows }),
        state: { values },
      },
    });

  it("returns localized errors for every empty field and writes nothing", async () => {
    const { deps, tempo, tasks } = fakeDeps();
    const res = await handleInteraction(submit({ [BLOCK.workDate]: field({ selected_date: "2026-11-25" }) }), deps);
    expect(await res.json()).toEqual({
      response_action: "errors",
      errors: {
        [rowBlock.project(1)]: "Pick a project for this row",
        [rowBlock.hours(1)]: "Enter hours for this project",
        [rowBlock.task(1)]: "Describe what you did",
      },
    });
    expect(tasks).toHaveLength(0);
    expect(tempo.submit).not.toHaveBeenCalled();
  });

  it("PTO without an end date is rejected in the user's locale", async () => {
    const { deps, tempo } = fakeDeps();
    tempo.resolveUser.mockResolvedValue({ ...profile, locale: "uk" });
    const res = await handleInteraction(
      payload({
        type: "view_submission",
        user: { id: "U123" },
        view: {
          id: "V_PTO",
          callback_id: CALLBACK.pto,
          private_metadata: encodeMetadata({ kind: "pto", logDate: "2026-11-26", userId: USER_ID, today: "2026-11-26", rows: 1 }),
          state: {
            values: {
              [BLOCK.ptoType]: field({ selected_option: { value: "vacation" } }),
              [BLOCK.ptoStart]: field({ selected_date: "2026-11-26" }),
            },
          },
        },
      }),
      deps,
    );
    expect(await res.json()).toEqual({
      response_action: "errors",
      errors: { [BLOCK.ptoEnd]: "Обери останній день (ту саму дату, якщо це один день)" },
    });
    expect(tempo.submit).not.toHaveBeenCalled();
  });
});

describe("A17 artifact links in bot posts", () => {
  const FIGMA = "https://www.figma.com/design/AbC123/Map-modal-v2?node-id=1-2";
  const JIRA = "https://acme.atlassian.net/browse/DOG-1364";

  it("standup card links plan and blockers too and posts with unfurls", async () => {
    const { deps, slack } = fakeDeps();
    const input: SlackSubmissionInput = {
      viewId: "V2",
      userId: USER_ID,
      kind: "standup",
      entries: [],
      checkin: { userId: USER_ID, checkinDate: "2026-11-26", plannedToday: `Review ${FIGMA}`, blockers: `Waiting on ${JIRA}` },
    };
    await routeSubmission(deps, profile, input);
    const card = slack.postMessage.mock.calls.find((c) => (c as unknown[])[0] === "C_STANDUP") as unknown as [string, string, Json[], unknown];
    const text = JSON.stringify(card[2]);
    expect(text).toContain("|Figma · Map modal v2>");
    expect(text).toContain(`<${JIRA}|Jira · DOG-1364>`);
    expect(card[3]).toEqual({ unfurl: true });
  });

  it("plain text is still escaped and text without URLs is unchanged", () => {
    const card = buildStandupCard({ fullName: "A", avatarUrl: null, yesterday: [], plannedToday: "<!here>", blockers: "" });
    expect(JSON.stringify(card.blocks)).toContain("&lt;!here&gt;");
  });
});
