import { describe, expect, it, vi } from "vitest";
import type { SlackSubmissionInput, TimeEntryInput } from "@/contracts";
import { ACTION, BLOCK, CALLBACK, INPUT_ACTION, rowBlock } from "../ids";
import { encodeMetadata, type ModalMetadata } from "../metadata";
import { fakeDeps, OTHER_PROJECT_ID, profile, PROJECT_ID, USER_ID } from "../testing/fake-deps";
import { handleSlashCommand } from "./commands";
import { handleEvent } from "./events";
import { handleInteraction } from "./interactions";
import { routeSubmission } from "./submit";

const form = (fields: Record<string, string>) => new URLSearchParams(fields);
const payload = (p: unknown) => form({ payload: JSON.stringify(p) });
const meta = (over: Partial<ModalMetadata> = {}): ModalMetadata => ({
  kind: "standup",
  logDate: "2026-11-25",
  userId: USER_ID,
  today: "2026-11-26",
  rows: 1,
  ...over,
});
const field = (v: object) => ({ [INPUT_ACTION]: v });
const standupSubmission = (values: Record<string, object>, m = meta(), user = "U123") => ({
  type: "view_submission",
  user: { id: user },
  view: { id: "V_SUB", callback_id: CALLBACK.time, private_metadata: encodeMetadata(m), state: { values } },
});
const goodValues = {
  [BLOCK.workDate]: field({ selected_date: "2026-11-25" }),
  [rowBlock.project(1)]: field({ selected_option: { value: PROJECT_ID } }),
  [rowBlock.hours(1)]: field({ value: "4" }),
  [rowBlock.task(1)]: field({ value: "Map modal DOG-1364" }),
};

describe("slash commands", () => {
  it("/log opens a loading modal first, then fills the log modal after the ack", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    const res = await handleSlashCommand(form({ command: "/log", trigger_id: "T1", user_id: "U123" }), deps);
    expect(res.status).toBe(200);
    expect(slack.openView).toHaveBeenCalledWith("T1", expect.objectContaining({ callback_id: CALLBACK.loading }));
    expect(tempo.resolveUser).not.toHaveBeenCalled(); // no DB work before the ack
    await flush();
    const [viewId, view] = slack.updateView.mock.calls[0] as unknown as [string, { callback_id: string; private_metadata: string }];
    expect(viewId).toBe("V_LOADING");
    expect(view.callback_id).toBe(CALLBACK.time);
    // Thursday 2026-11-26 in Kyiv → previous business day Wednesday
    expect(JSON.parse(view.private_metadata)).toMatchObject({ kind: "log", logDate: "2026-11-25", today: "2026-11-26" });
  });

  it("/pto defaults to today; unlinked users get a notice", async () => {
    const { deps, slack, flush } = fakeDeps();
    await handleSlashCommand(form({ command: "/pto", trigger_id: "T1", user_id: "U123" }), deps);
    await handleSlashCommand(form({ command: "/pto", trigger_id: "T2", user_id: "U_STRANGER" }), deps);
    await flush();
    const views = slack.updateView.mock.calls.map((c) => (c as unknown[])[1] as { callback_id: string; private_metadata?: string });
    expect(views[0].callback_id).toBe(CALLBACK.pto);
    expect(JSON.parse(views[0].private_metadata!)).toMatchObject({ kind: "pto", logDate: "2026-11-26" });
    expect(views[1].callback_id).toBe(CALLBACK.notice);
  });

  it("answers ephemerally when views.open fails or the command is unknown", async () => {
    const { deps, slack } = fakeDeps();
    slack.openView.mockRejectedValueOnce(new Error("expired_trigger_id"));
    const failed = await handleSlashCommand(form({ command: "/log", trigger_id: "T", user_id: "U123" }), deps);
    expect(await failed.json()).toMatchObject({ response_type: "ephemeral" });
    const unknown = await handleSlashCommand(form({ command: "/nope", trigger_id: "T", user_id: "U123" }), deps);
    expect((await unknown.json()).text).toContain("Unknown command");
  });
});

describe("interactions", () => {
  it("legacy morning DM button (pre-A16 DMs) still opens the standup modal with the button's log date", async () => {
    const { deps, slack, flush } = fakeDeps();
    await handleInteraction(
      payload({ type: "block_actions", trigger_id: "T9", user: { id: "U123" }, actions: [{ action_id: ACTION.openStandup, value: "2026-11-20" }] }),
      deps,
    );
    expect(slack.openView).toHaveBeenCalledWith("T9", expect.anything());
    await flush();
    const view = (slack.updateView.mock.calls[0] as unknown[])[1] as { private_metadata: string };
    expect(JSON.parse(view.private_metadata)).toMatchObject({ kind: "standup", logDate: "2026-11-20" });
  });

  it("add row updates the view with one more row and the view hash", async () => {
    const { deps, slack, flush } = fakeDeps();
    await handleInteraction(
      payload({
        type: "block_actions",
        user: { id: "U123" },
        actions: [{ action_id: ACTION.addRow }],
        view: { id: "V_OPEN", hash: "h1", private_metadata: encodeMetadata(meta()) },
      }),
      deps,
    );
    await flush();
    const [viewId, view, hash] = slack.updateView.mock.calls[0] as unknown as [string, { private_metadata: string }, string];
    expect([viewId, hash]).toEqual(["V_OPEN", "h1"]);
    expect(JSON.parse(view.private_metadata).rows).toBe(2);
  });

  it("valid submission acks empty, then submits and broadcasts after the response", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    const res = await handleInteraction(payload(standupSubmission(goodValues)), deps);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(tempo.submit).not.toHaveBeenCalled();
    await flush();
    expect(tempo.submit).toHaveBeenCalledWith(expect.objectContaining({ viewId: "V_SUB", kind: "standup", userId: USER_ID }));
    const card = slack.postMessage.mock.calls.find((c) => (c as unknown[])[0] === "C_STANDUP");
    expect(JSON.stringify(card)).toContain("4h DogTeamPro — Map modal DOG-1364");
    // A29: no plan or blockers are collected, so the card is yesterday only and there is no check-in.
    expect(JSON.stringify(card)).not.toMatch(/Today|blocker/i);
    expect(tempo.setCheckinChannelTs).not.toHaveBeenCalled();
  });

  it("A35: task text over 500 characters is rejected, but links do not count", async () => {
    const withTask = (value: string) => payload(standupSubmission({ ...goodValues, [rowBlock.task(1)]: field({ value }) }));
    const { deps } = fakeDeps();
    const long = await handleInteraction(withTask("a".repeat(501)), deps);
    expect(await long.json()).toEqual({ response_action: "errors", errors: { [rowBlock.task(1)]: expect.stringContaining("500") } });
    const linked = await handleInteraction(withTask(`Done\nhttps://www.figma.com/design/${"x".repeat(600)}`), deps);
    expect(await linked.text()).toBe("");
  });

  it("returns field errors synchronously and writes nothing", async () => {
    const { deps, tempo, tasks } = fakeDeps();
    const res = await handleInteraction(
      payload(standupSubmission({ ...goodValues, [rowBlock.project(1)]: field({ selected_option: null }) })),
      deps,
    );
    expect(await res.json()).toEqual({ response_action: "errors", errors: { [rowBlock.project(1)]: expect.any(String) } });
    expect(tasks).toHaveLength(0);
    expect(tempo.submit).not.toHaveBeenCalled();
  });

  it("duplicate view id (Slack retry) is a no-op: no broadcast", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    tempo.submit.mockResolvedValueOnce({ status: "duplicate" } as never);
    await handleInteraction(payload(standupSubmission(goodValues)), deps);
    await flush();
    expect(slack.postMessage).not.toHaveBeenCalled();
  });

  it("rejects a submission whose metadata user differs from the Slack user", async () => {
    const { deps, tempo } = fakeDeps();
    const other = meta({ userId: "0b4c6a52-8f1e-4c1b-9a35-3b1f8f0f6a02" });
    const res = await handleInteraction(payload(standupSubmission(goodValues, other)), deps);
    expect(await res.json()).toMatchObject({ response_action: "update" });
    expect(tempo.submit).not.toHaveBeenCalled();
  });

  it("PTO submission uses the user's office holidays and submits one entry per business day", async () => {
    const { deps, tempo, flush } = fakeDeps();
    const res = await handleInteraction(
      payload({
        type: "view_submission",
        user: { id: "U123" },
        view: {
          id: "V_PTO",
          callback_id: CALLBACK.pto,
          private_metadata: encodeMetadata(meta({ kind: "pto" })),
          state: {
            values: {
              [BLOCK.ptoType]: field({ selected_option: { value: "vacation" } }),
              [BLOCK.ptoStart]: field({ selected_date: "2026-12-24" }),
              [BLOCK.ptoEnd]: field({ selected_date: "2026-12-28" }),
            },
          },
        },
      }),
      deps,
    );
    expect(res.status).toBe(200);
    await flush();
    const input = (tempo.submit.mock.calls[0] as unknown[])[0] as { entries: Array<{ workDate: string }> };
    expect(input.entries.map((e) => e.workDate)).toEqual(["2026-12-24", "2026-12-28"]); // 25th holiday, weekend
    expect(tempo.listHolidayDates).toHaveBeenCalledWith(USER_ID, "2026-12-24", "2026-12-28");
  });

  it("A15: a user without office holidays gets PTO on the 25th too", async () => {
    const { deps, tempo, flush } = fakeDeps();
    tempo.listHolidayDates.mockResolvedValue([]);
    await handleInteraction(
      payload({
        type: "view_submission",
        user: { id: "U123" },
        view: {
          id: "V_PTO2",
          callback_id: CALLBACK.pto,
          private_metadata: encodeMetadata(meta({ kind: "pto" })),
          state: {
            values: {
              [BLOCK.ptoType]: field({ selected_option: { value: "vacation" } }),
              [BLOCK.ptoStart]: field({ selected_date: "2026-12-24" }),
              [BLOCK.ptoEnd]: field({ selected_date: "2026-12-25" }),
            },
          },
        },
      }),
      deps,
    );
    await flush();
    const input = (tempo.submit.mock.calls[0] as unknown[])[0] as { entries: Array<{ workDate: string }> };
    expect(input.entries.map((e) => e.workDate)).toEqual(["2026-12-24", "2026-12-25"]);
  });
});

describe("A11 channel routing", () => {
  const entry = (projectId: string | null, hours: number, taskSummary: string, entryType: "work" | "vacation" = "work"): TimeEntryInput => ({
    userId: USER_ID,
    projectId,
    workDate: "2026-11-25",
    hours,
    taskSummary,
    entryType,
    source: "slack_standup",
    slackViewId: "V1",
  });
  const input = (kind: SlackSubmissionInput["kind"], entries: TimeEntryInput[]): SlackSubmissionInput => ({
    viewId: "V1",
    userId: USER_ID,
    kind,
    entries,
    checkin: kind === "standup" ? { userId: USER_ID, checkinDate: "2026-11-26", plannedToday: "Secret plan", blockers: "Blocked on API" } : null,
  });
  const posts = (slack: ReturnType<typeof fakeDeps>["slack"]) =>
    new Map(slack.postMessage.mock.calls.map((c) => [(c as unknown[])[0] as string, (c as unknown[])[1] as string]));

  const shown = (slack: ReturnType<typeof fakeDeps>["slack"]) =>
    new Map(slack.postEphemeral.mock.calls.map((c) => [c[0], JSON.stringify(c)]));

  it("A33: a quick Logged line per project, only for the submitter, no task text and no DM", async () => {
    const { deps, slack } = fakeDeps();
    await routeSubmission(
      deps,
      profile,
      input("standup", [entry(PROJECT_ID, 4, "Map modal DOG-1364"), entry(OTHER_PROJECT_ID, 2.5, "Swap fix"), entry(PROJECT_ID, 1, "Review")]),
    );
    const seen = shown(slack);
    expect(slack.postEphemeral.mock.calls.every((c) => c[1] === "U123")).toBe(true);
    expect(seen.get("C_DTP")).toContain("✅ Logged 5h · DogTeamPro · ");
    expect(seen.get("C_CNG")).toContain("✅ Logged 2.5h · Changelly · ");
    for (const text of seen.values()) expect(text).not.toMatch(/Map modal|Swap fix|Secret plan|Blocked on API/);
    expect([...posts(slack).keys()]).toEqual(["C_STANDUP"]);
  });

  it("log submission: channel line only, no DM or general card", async () => {
    const { deps, slack, tempo } = fakeDeps();
    await routeSubmission(deps, profile, input("log", [entry(PROJECT_ID, 3, "Map modal")]));
    expect([...shown(slack).keys()]).toEqual(["C_DTP"]);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(tempo.getStandupChannelId).not.toHaveBeenCalled();
    expect(tempo.setCheckinChannelTs).not.toHaveBeenCalled();
  });

  it("A32: time off is confirmed by DM only, in the user's locale", async () => {
    const { deps, slack } = fakeDeps();
    await routeSubmission(deps, { ...profile, locale: "uk" }, input("pto", [entry(null, 0, "", "vacation")]));
    expect([...posts(slack).keys()]).toEqual(["D_U123"]);
    expect(posts(slack).get("D_U123")).toMatch(/Відсутність збережено: Відпустка · .* · 1 день/);
    expect(slack.postEphemeral).not.toHaveBeenCalled();
  });

  it("no general standup channel → no card; a project without a channel is confirmed by DM", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.getStandupChannelId.mockResolvedValueOnce(null);
    tempo.listProjectChannels.mockResolvedValueOnce([{ projectId: PROJECT_ID, projectName: "DogTeamPro", slackChannelId: "C_DTP" }]);
    await routeSubmission(deps, profile, input("standup", [entry(PROJECT_ID, 1, "a"), entry(OTHER_PROJECT_ID, 1, "b")]));
    expect([...shown(slack).keys()]).toEqual(["C_DTP"]);
    expect([...posts(slack).keys()]).toEqual(["D_U123"]);
    expect(tempo.setCheckinChannelTs).not.toHaveBeenCalled();
  });

  const cardChannels = (slack: ReturnType<typeof fakeDeps>["slack"]) =>
    slack.postMessage.mock.calls
      .filter((c) => JSON.stringify(c).includes("Secret plan"))
      .map((c) => (c as unknown[])[0] as string);

  it("A15: the full card goes to the general standup channel only; its ts is stored", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.getStandupChannelId.mockResolvedValueOnce("C_GENERAL");
    await routeSubmission(deps, profile, input("standup", [entry(PROJECT_ID, 1, "a")]));
    expect(cardChannels(slack)).toEqual(["C_GENERAL"]);
    expect(shown(slack).has("C_DTP")).toBe(true);
    expect(tempo.setCheckinChannelTs).toHaveBeenCalledWith(USER_ID, "2026-11-26", "1700000000.000100");
  });

  it("A15: a failing general post is logged and stores no ts", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    slack.postMessage.mockRejectedValueOnce(new Error("not_in_channel"));
    await routeSubmission(deps, profile, input("standup", []));
    expect(tempo.setCheckinChannelTs).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith("slack: standup post failed", "C_STANDUP", "not_in_channel");
    errors.mockRestore();
  });

  it("one refused channel falls back to a DM and does not stop the others", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    slack.postEphemeral.mockImplementation(async (channel: string) => {
      if (channel === "C_DTP") throw new Error("user_not_in_channel");
    });
    await routeSubmission(deps, profile, input("standup", [entry(PROJECT_ID, 1, "a"), entry(OTHER_PROJECT_ID, 1, "b")]));
    expect(slack.postMessage.mock.calls.map((c) => (c as unknown[])[0]).sort()).toEqual(["C_STANDUP", "D_U123"]);
    expect(tempo.setCheckinChannelTs).toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith("slack: ephemeral post failed", "C_DTP", "user_not_in_channel");
    errors.mockRestore();
  });

  it("a failing channel lookup does not block the general card", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tempo.listProjectChannels.mockRejectedValueOnce(new Error("db down"));
    await routeSubmission(deps, profile, input("standup", [entry(PROJECT_ID, 1, "a")]));
    expect([...posts(slack).keys()]).toEqual(["C_STANDUP"]);
    errors.mockRestore();
  });
});

describe("events", () => {
  it("answers url_verification and acks retries without work", async () => {
    const { deps, tasks } = fakeDeps();
    const challenge = await handleEvent(JSON.stringify({ type: "url_verification", challenge: "abc" }), new Headers(), deps);
    expect(await challenge.json()).toEqual({ challenge: "abc" });
    const body = JSON.stringify({ type: "event_callback", event: { type: "app_home_opened", user: "U123", tab: "home" } });
    await handleEvent(body, new Headers({ "x-slack-retry-num": "1" }), deps);
    expect(tasks).toHaveLength(0);
  });

  it("app_home_opened publishes the Home tab after the ack", async () => {
    const { deps, slack, flush } = fakeDeps();
    const body = JSON.stringify({ type: "event_callback", event: { type: "app_home_opened", user: "U123", tab: "home" } });
    expect((await handleEvent(body, new Headers(), deps)).status).toBe(200);
    await flush();
    expect(slack.publishHome).toHaveBeenCalledWith("U123", expect.objectContaining({ type: "home" }));
  });
});
