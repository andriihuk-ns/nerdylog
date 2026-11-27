import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/queries/project-prompts", () => ({
  listPromptProjectRows: vi.fn(),
  listOfficeZones: vi.fn(),
  claimProjectPromptRows: vi.fn(),
  listPromptRecipientRows: vi.fn(),
}));
vi.mock("@/server/db/queries/catalog", () => ({ listOfficeHolidayDates: vi.fn() }));

import * as catalog from "@/server/db/queries/catalog";
import * as prompts from "@/server/db/queries/project-prompts";
import { claimProjectPrompts } from "./project-prompt-service";

const MON_10_KYIV = new Date("2026-11-30T08:00:00Z"); // 09:00 Warsaw

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prompts.listPromptProjectRows).mockResolvedValue([
    { projectId: "a", projectName: "A", slackChannelId: "CA", statusPromptTime: "10:00", officeId: "ua", timezone: null },
    { projectId: "b", projectName: "B", slackChannelId: "CB", statusPromptTime: "10:00", officeId: null, timezone: null },
    { projectId: "c", projectName: "C", slackChannelId: "CC", statusPromptTime: "09:00", officeId: "pl", timezone: null },
    { projectId: "d", projectName: "D", slackChannelId: "CD", statusPromptTime: "10:00", officeId: "pl", timezone: null }, // 09:00 local
  ]);
  vi.mocked(prompts.listOfficeZones).mockResolvedValue([
    { id: "ua", code: "UA", timezone: "Europe/Kyiv" },
    { id: "pl", code: "PL", timezone: "Europe/Warsaw" },
  ]);
  vi.mocked(catalog.listOfficeHolidayDates).mockResolvedValue([]);
  vi.mocked(prompts.listPromptRecipientRows).mockResolvedValue([{ projectId: "a", slackUserId: "U_A" }]);
  vi.mocked(prompts.claimProjectPromptRows).mockImplementation(async (_db, rows) => rows.map((r) => r.projectId));
});

describe("claimProjectPrompts", () => {
  it("claims due projects for their local date and returns them with logDate", async () => {
    const targets = await claimProjectPrompts(MON_10_KYIV);
    expect(catalog.listOfficeHolidayDates).toHaveBeenCalledWith({}, ["ua", "pl"], "2026-10-30", "2026-11-30");
    expect(prompts.claimProjectPromptRows).toHaveBeenCalledWith({}, [
      { projectId: "a", promptDate: "2026-11-30" },
      { projectId: "b", promptDate: "2026-11-30" },
      { projectId: "c", promptDate: "2026-11-30" },
    ]);
    expect(targets).toEqual([
      { projectId: "a", projectName: "A", slackChannelId: "CA", localDate: "2026-11-30", logDate: "2026-11-27", memberSlackIds: ["U_A"] },
      { projectId: "b", projectName: "B", slackChannelId: "CB", localDate: "2026-11-30", logDate: "2026-11-27", memberSlackIds: [] },
      { projectId: "c", projectName: "C", slackChannelId: "CC", localDate: "2026-11-30", logDate: "2026-11-27", memberSlackIds: [] },
    ]);
  });

  it("already claimed projects (earlier run) are not returned", async () => {
    vi.mocked(prompts.claimProjectPromptRows).mockResolvedValue(["c"]);
    const targets = await claimProjectPrompts(MON_10_KYIV);
    expect(targets.map((t) => t.projectId)).toEqual(["c"]);
  });

  it("an office holiday drops only that office's projects (null office follows UA)", async () => {
    vi.mocked(catalog.listOfficeHolidayDates).mockResolvedValue([
      { officeId: "ua", date: "2026-11-30" },
      { officeId: "pl", date: "2026-11-27" },
    ]);
    const targets = await claimProjectPrompts(MON_10_KYIV);
    expect(targets.map((t) => [t.projectId, t.logDate])).toEqual([["c", "2026-11-26"]]);
  });

  it("no queries beyond the project list when nothing is due", async () => {
    await expect(claimProjectPrompts(new Date("2026-11-30T12:00:00Z"))).resolves.toEqual([]);
    expect(catalog.listOfficeHolidayDates).not.toHaveBeenCalled();
    expect(prompts.claimProjectPromptRows).not.toHaveBeenCalled();
    vi.mocked(prompts.listPromptProjectRows).mockResolvedValue([]);
    await expect(claimProjectPrompts(MON_10_KYIV)).resolves.toEqual([]);
    expect(prompts.listOfficeZones).toHaveBeenCalledTimes(1);
  });

  it("weekend → nothing claimed", async () => {
    await expect(claimProjectPrompts(new Date("2026-11-28T08:00:00Z"))).resolves.toEqual([]);
    expect(prompts.claimProjectPromptRows).not.toHaveBeenCalled();
  });
});
