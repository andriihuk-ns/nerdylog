import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { db: true };
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
vi.mock("@/server/db/queries/settings", () => ({
  SETTING_KEYS: { standupChannelId: "standup_channel_id" },
  getSetting: vi.fn(),
  upsertSetting: vi.fn(),
  deleteSetting: vi.fn(),
}));
vi.mock("@/server/db/queries/catalog", () => ({ listProjectChannelRows: vi.fn() }));

import * as cat from "@/server/db/queries/catalog";
import * as q from "@/server/db/queries/settings";
import { ForbiddenError, InvalidInputError } from "./errors";
import { getAppSettings, getStandupChannelId, listProjectChannels, updateAppSettings } from "./settings-service";

const ID = "11111111-1111-4111-8111-111111111111";
const admin = { userId: ID, role: "admin" as const };
const manager = { userId: ID, role: "manager" as const };
const member = { userId: ID, role: "member" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(q.getSetting).mockResolvedValue("C0STANDUP1");
});

describe("getAppSettings", () => {
  it("manager/admin read; member forbidden", async () => {
    await expect(getAppSettings(member)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getAppSettings(manager)).resolves.toEqual({ standupChannelId: "C0STANDUP1" });
    await expect(getAppSettings(admin)).resolves.toEqual({ standupChannelId: "C0STANDUP1" });
    expect(q.getSetting).toHaveBeenCalledWith(db, "standup_channel_id");
  });

  it("absent row → null", async () => {
    vi.mocked(q.getSetting).mockResolvedValue(null);
    await expect(getAppSettings(manager)).resolves.toEqual({ standupChannelId: null });
  });
});

describe("updateAppSettings", () => {
  it("admin only", async () => {
    await expect(updateAppSettings(manager, { standupChannelId: "C0123ABCD" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateAppSettings(member, { standupChannelId: null })).rejects.toBeInstanceOf(ForbiddenError);
    expect(q.upsertSetting).not.toHaveBeenCalled();
    expect(q.deleteSetting).not.toHaveBeenCalled();
  });

  it("upserts a valid channel (trimmed) and returns fresh settings", async () => {
    vi.mocked(q.getSetting).mockResolvedValue("G0PRIVATE1");
    await expect(updateAppSettings(admin, { standupChannelId: " G0PRIVATE1 " })).resolves.toEqual({
      standupChannelId: "G0PRIVATE1",
    });
    expect(q.upsertSetting).toHaveBeenCalledWith(db, "standup_channel_id", "G0PRIVATE1");
    expect(q.deleteSetting).not.toHaveBeenCalled();
  });

  it("null or blank deletes the row", async () => {
    vi.mocked(q.getSetting).mockResolvedValue(null);
    await expect(updateAppSettings(admin, { standupChannelId: null })).resolves.toEqual({ standupChannelId: null });
    await updateAppSettings(admin, { standupChannelId: "  " });
    expect(q.deleteSetting).toHaveBeenCalledTimes(2);
    expect(q.deleteSetting).toHaveBeenCalledWith(db, "standup_channel_id");
    expect(q.upsertSetting).not.toHaveBeenCalled();
  });

  it("omitted key leaves the setting alone", async () => {
    await expect(updateAppSettings(admin, {})).resolves.toEqual({ standupChannelId: "C0STANDUP1" });
    expect(q.upsertSetting).not.toHaveBeenCalled();
    expect(q.deleteSetting).not.toHaveBeenCalled();
  });

  it.each(["general", "#general", "c0123abcd", "C0123", "D0123ABCD", "U0123ABCD"])("rejects %s with a field error", async (id) => {
    const err = await updateAppSettings(admin, { standupChannelId: id }).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(Object.keys(err.fieldErrors)).toEqual(["standupChannelId"]);
    expect(q.upsertSetting).not.toHaveBeenCalled();
  });
});

describe("system reads", () => {
  it("getStandupChannelId returns the stored value or null", async () => {
    await expect(getStandupChannelId()).resolves.toBe("C0STANDUP1");
    vi.mocked(q.getSetting).mockResolvedValue(null);
    await expect(getStandupChannelId()).resolves.toBeNull();
  });

  it("listProjectChannels passes rows through", async () => {
    const rows = [{ projectId: ID, projectName: "DogTeamPro", slackChannelId: "C0123ABCD" }];
    vi.mocked(cat.listProjectChannelRows).mockResolvedValue(rows);
    await expect(listProjectChannels()).resolves.toEqual(rows);
    expect(cat.listProjectChannelRows).toHaveBeenCalledWith(db);
  });
});
