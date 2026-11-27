import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { InvalidInputError } from "@/server/services/errors";
import { ACTION, BLOCK, CALLBACK, INPUT_ACTION, rowBlock } from "../ids";
import { encodeMetadata, type ModalMetadata } from "../metadata";
import {
  fakeDeps,
  FOREIGN_PROJECT_ID,
  foreignProject,
  OTHER_PROJECT_ID,
  otherProject,
  profile,
  project,
  PROJECT_ID,
  USER_ID,
} from "../testing/fake-deps";
import { handleSlashCommand } from "./commands";
import { handleInteraction } from "./interactions";

/** A15: project access by channel membership, App Home buttons, teams removed. */
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
const standupSubmission = (values: Record<string, object>) => ({
  type: "view_submission",
  user: { id: "U123" },
  view: { id: "V_SUB", callback_id: CALLBACK.time, private_metadata: encodeMetadata(meta()), state: { values } },
});
const goodValues = {
  [BLOCK.workDate]: field({ selected_date: "2026-11-25" }),
  [rowBlock.project(1)]: field({ selected_option: { value: PROJECT_ID } }),
  [rowBlock.hours(1)]: field({ value: "4" }),
  [rowBlock.task(1)]: field({ value: "Map modal DOG-1364" }),
};

describe("A15 project access", () => {
  const optionValues = (view: unknown) =>
    [...JSON.stringify(view).matchAll(/"value":"([0-9a-f-]{36})"/g)].map((m) => m[1]);

  it("the log modal lists only projects the user is a member of", async () => {
    const { deps, slack, flush } = fakeDeps();
    await handleSlashCommand(form({ command: "/log", trigger_id: "T1", user_id: "U123" }), deps);
    await flush();
    const view = (slack.updateView.mock.calls[0] as unknown[])[1];
    expect(optionValues(view)).toEqual([PROJECT_ID, OTHER_PROJECT_ID]);
    expect(optionValues(view)).not.toContain(FOREIGN_PROJECT_ID);
  });

  it("no member projects → a localized notice instead of rows", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    tempo.listProjects.mockResolvedValue([foreignProject]);
    await handleSlashCommand(form({ command: "/log", trigger_id: "T1", user_id: "U123" }), deps);
    await flush();
    const text = JSON.stringify((slack.updateView.mock.calls[0] as unknown[])[1]);
    expect(text).toContain("You're not in any project channel yet. Ask an admin to add you.");
    expect(text).not.toContain(rowBlock.project(1));
  });

  it("submitting a non-member project returns a field error naming the creator and channel", async () => {
    const { deps, tempo, tasks } = fakeDeps();
    const values = { ...goodValues, [rowBlock.project(1)]: field({ selected_option: { value: FOREIGN_PROJECT_ID } }) };
    const res = await handleInteraction(payload(standupSubmission(values)), deps);
    expect(await res.json()).toEqual({
      response_action: "errors",
      errors: { [rowBlock.project(1)]: "You're not in #swz. Ask Andrii Admin to add you." },
    });
    expect(tasks).toHaveLength(0);
    expect(tempo.submit).not.toHaveBeenCalled();
  });

  it("falls back to 'an admin' and the project name when creator and channel name are unknown (uk)", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.resolveUser.mockResolvedValue({ ...profile, locale: "uk" });
    tempo.listProjects.mockResolvedValue([{ ...foreignProject, createdBy: null }]);
    slack.channelName.mockResolvedValue(null);
    const values = { ...goodValues, [rowBlock.project(1)]: field({ selected_option: { value: FOREIGN_PROJECT_ID } }) };
    const res = await handleInteraction(payload(standupSubmission(values)), deps);
    expect((await res.json()).errors[rowBlock.project(1)]).toBe("Тебе немає в каналі проєкту Swapzone. Попроси адміна додати тебе.");
  });

  it("a service not_member rejection after the ack is explained in a DM", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Membership changed between the pre-check and the write.
    tempo.listProjects
      .mockResolvedValueOnce([project, otherProject])
      .mockResolvedValue([{ ...project, isMember: false }, otherProject]);
    tempo.submit.mockRejectedValueOnce(new InvalidInputError({ projectId: ["not_member"] }));
    await handleInteraction(payload(standupSubmission(goodValues)), deps);
    await flush();
    const dm = slack.postMessage.mock.calls.find((c) => (c as unknown[])[0] === "D_U123") as unknown[];
    expect(dm[1]).toBe("Your time for DogTeamPro was not saved. You're not in #dtp. Ask Andrii Admin to add you.");
    errors.mockRestore();
  });
});

describe("A15 App Home buttons", () => {
  it.each([
    [ACTION.homeLog, CALLBACK.time, "log"],
    [ACTION.homePto, CALLBACK.pto, "pto"],
  ])("%s opens the same modal as the slash command", async (actionId, callback, kind) => {
    const { deps, slack, flush } = fakeDeps();
    const res = await handleInteraction(
      payload({ type: "block_actions", trigger_id: "T_HOME", user: { id: "U123" }, actions: [{ action_id: actionId }] }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(slack.openView).toHaveBeenCalledWith("T_HOME", expect.objectContaining({ callback_id: CALLBACK.loading }));
    await flush();
    const view = (slack.updateView.mock.calls[0] as unknown[])[1] as { callback_id: string; private_metadata: string };
    expect(view.callback_id).toBe(callback);
    expect(JSON.parse(view.private_metadata)).toMatchObject({ kind });
  });
});

describe("A15 teams removed", () => {
  it("the user-group module and the team routing port are gone", () => {
    expect(existsSync(fileURLToPath(new URL("../usergroups.ts", import.meta.url)))).toBe(false);
    expect("listStandupChannelsForUser" in fakeDeps().tempo).toBe(false);
  });
});
