import { describe, expect, it, vi } from "vitest";
import type { SlackSubmissionInput, TimeEntryInput } from "@/contracts";
import { ACTION, BLOCK, CALLBACK, INPUT_ACTION, rowBlock } from "../ids";
import { encodeMetadata, type ModalMetadata } from "../metadata";
import { fakeDeps, OTHER_PROJECT_ID, profile, PROJECT_ID, USER_ID } from "../testing/fake-deps";
import { handleSlashCommand } from "./commands";
import { handleEvent } from "./events";
import { handleInteraction } from "./interactions";
import { runMorningPings } from "./morning-ping";
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
  [BLOCK.plan]: field({ value: "Handler mobile flow" }),
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
  it("morning DM button opens the standup modal with the button's log date", async () => {
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
    expect(tempo.setCheckinChannelTs).toHaveBeenCalledWith(USER_ID, "2026-11-26", "1700000000.000100");
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

  it("PTO submission fetches holidays and submits one entry per business day", async () => {
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

  it("posts only each project's lines to its own channel, never plan or blockers", async () => {
    const { deps, slack } = fakeDeps();
    await routeSubmission(
      deps,
      profile,
      input("standup", [entry(PROJECT_ID, 4, "Map modal DOG-1364"), entry(OTHER_PROJECT_ID, 2.5, "Swap fix"), entry(PROJECT_ID, 1, "Review")]),
    );
    const sent = posts(slack);
    expect(sent.get("C_DTP")).toBe("Olena Petrenko · 4h · Map modal DOG-1364 (DOG-1364)\nOlena Petrenko · 1h · Review");
    expect(sent.get("C_CNG")).toBe("Olena Petrenko · 2.5h · Swap fix");
    for (const ch of ["C_DTP", "C_CNG"]) expect(sent.get(ch)).not.toMatch(/Secret plan|Blocked on API/);
    expect(sent.has("C_STANDUP")).toBe(true);
  });

  it("log submission: project lines only for projects in it, no general card", async () => {
    const { deps, slack, tempo } = fakeDeps();
    await routeSubmission(deps, profile, input("log", [entry(PROJECT_ID, 3, "Map modal")]));
    expect([...posts(slack).keys()]).toEqual(["C_DTP"]);
    expect(tempo.listStandupChannelsForUser).not.toHaveBeenCalled();
    expect(tempo.setCheckinChannelTs).not.toHaveBeenCalled();
  });

  it("PTO-only submission posts nothing", async () => {
    const { deps, slack } = fakeDeps();
    await routeSubmission(deps, profile, input("pto", [entry(null, 0, "", "vacation")]));
    expect(slack.postMessage).not.toHaveBeenCalled();
  });

  it("empty standup channel list → no card; projects without a channel get nothing", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.listStandupChannelsForUser.mockResolvedValueOnce([]);
    tempo.listProjectChannels.mockResolvedValueOnce([{ projectId: PROJECT_ID, projectName: "DogTeamPro", slackChannelId: "C_DTP" }]);
    await routeSubmission(deps, profile, input("standup", [entry(PROJECT_ID, 1, "a"), entry(OTHER_PROJECT_ID, 1, "b")]));
    expect([...posts(slack).keys()]).toEqual(["C_DTP"]);
    expect(tempo.setCheckinChannelTs).not.toHaveBeenCalled();
  });

  const cardChannels = (slack: ReturnType<typeof fakeDeps>["slack"]) =>
    slack.postMessage.mock.calls
      .filter((c) => JSON.stringify(c).includes("Secret plan"))
      .map((c) => (c as unknown[])[0] as string);

  it("A13: user in two teams → the full card goes to both team channels", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.listStandupChannelsForUser.mockResolvedValueOnce(["C_DESIGN", "C_MOBILE"]);
    await routeSubmission(deps, profile, input("standup", [entry(PROJECT_ID, 1, "a")]));
    expect(tempo.listStandupChannelsForUser).toHaveBeenCalledWith(USER_ID);
    expect(cardChannels(slack).sort()).toEqual(["C_DESIGN", "C_MOBILE"]);
    expect(posts(slack).has("C_DTP")).toBe(true); // project lines unchanged
    expect(tempo.setCheckinChannelTs).toHaveBeenCalledTimes(1);
  });

  it("A13: a duplicate channel gets the card once", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.listStandupChannelsForUser.mockResolvedValueOnce(["C_DESIGN", "C_DESIGN"]);
    await routeSubmission(deps, profile, input("standup", []));
    expect(cardChannels(slack)).toEqual(["C_DESIGN"]);
  });

  it("A13: no team → the general channel returned by the service gets the card", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.listStandupChannelsForUser.mockResolvedValueOnce(["C_GENERAL"]);
    await routeSubmission(deps, profile, input("standup", []));
    expect(cardChannels(slack)).toEqual(["C_GENERAL"]);
    expect(tempo.setCheckinChannelTs).toHaveBeenCalledWith(USER_ID, "2026-11-26", "1700000000.000100");
  });

  it("A13: a failing team channel does not block the others; first successful ts is stored", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tempo.listStandupChannelsForUser.mockResolvedValueOnce(["C_A", "C_B", "C_C"]);
    slack.postMessage.mockImplementation((async (channel: string) => {
      if (channel === "C_A") throw new Error("not_in_channel");
      return channel === "C_B" ? "1700000000.000B" : "1700000000.000C";
    }) as never);
    await routeSubmission(deps, profile, input("standup", []));
    expect(cardChannels(slack).sort()).toEqual(["C_A", "C_B", "C_C"]);
    expect(tempo.setCheckinChannelTs).toHaveBeenCalledWith(USER_ID, "2026-11-26", "1700000000.000B");
    expect(errors).toHaveBeenCalledWith("slack: standup post failed", "C_A", "not_in_channel");
    errors.mockRestore();
  });

  it("one failing post does not stop the others", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    slack.postMessage.mockImplementation((async (channel: string) => {
      if (channel === "C_DTP") throw new Error("not_in_channel");
      return "1700000000.000200";
    }) as never);
    await routeSubmission(deps, profile, input("standup", [entry(PROJECT_ID, 1, "a"), entry(OTHER_PROJECT_ID, 1, "b")]));
    expect(slack.postMessage.mock.calls.map((c) => (c as unknown[])[0]).sort()).toEqual(["C_CNG", "C_DTP", "C_STANDUP"]);
    expect(tempo.setCheckinChannelTs).toHaveBeenCalledWith(USER_ID, "2026-11-26", "1700000000.000200");
    expect(errors).toHaveBeenCalledWith("slack: project post failed", "C_DTP", "not_in_channel");
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

describe("morning ping", () => {
  it("DMs each claimed user and continues past failures", async () => {
    const { deps, slack, tempo } = fakeDeps();
    const target = (id: string) => ({ userId: USER_ID, slackUserId: id, timezone: "Europe/Kyiv", localDate: "2026-11-26", logDate: "2026-11-25" });
    tempo.claimMorningPings.mockResolvedValueOnce([target("U1"), target("U2"), target("U3")] as never);
    slack.openDm.mockRejectedValueOnce(new Error("user_not_found"));
    expect(await runMorningPings(deps)).toEqual({ claimed: 3, sent: 2, failed: 1 });
    expect(slack.postMessage).toHaveBeenCalledTimes(2);
  });
});
