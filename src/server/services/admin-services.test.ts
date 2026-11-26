import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = { tx: true };
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ transaction: (fn: (t: unknown) => unknown) => fn(tx) }),
}));
vi.mock("@/server/db/queries/directory", () => ({
  listDirectoryUsers: vi.fn(),
  updateDirectoryRow: vi.fn(),
  findUsersBySlackIds: vi.fn(),
  insertDirectoryUsers: vi.fn(),
  updateUserProfileBySlackId: vi.fn(),
}));
vi.mock("@/server/db/queries/catalog", () => ({
  listProjectViews: vi.fn(),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  listHolidayViews: vi.fn(),
  insertHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
}));

import * as cat from "@/server/db/queries/catalog";
import * as dir from "@/server/db/queries/directory";
import { listDirectory, syncDirectoryFromSlack, updateDirectoryUser } from "./directory-service";
import { ForbiddenError, InvalidInputError, NotFoundError } from "./errors";
import { addHoliday, removeHoliday } from "./holiday-service";
import { upsertProject } from "./project-service";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const admin = { userId: ADMIN, role: "admin" as const };
const manager = { userId: ADMIN, role: "manager" as const };
const member = { userId: ADMIN, role: "member" as const };
const uniqueErr = (constraint: string) => Object.assign(new Error("dup"), { code: "23505", constraint_name: constraint });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dir.listDirectoryUsers).mockResolvedValue([]);
  vi.mocked(dir.updateDirectoryRow).mockResolvedValue({ id: OTHER } as never);
  vi.mocked(dir.findUsersBySlackIds).mockResolvedValue(["U1"]);
  vi.mocked(dir.insertDirectoryUsers).mockResolvedValue(1);
  vi.mocked(dir.updateUserProfileBySlackId).mockResolvedValue(true);
  vi.mocked(cat.deleteHoliday).mockResolvedValue(true);
});

describe("directory RBAC", () => {
  it("list: manager/admin yes, member no", async () => {
    await expect(listDirectory(member)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listDirectory(manager)).resolves.toEqual([]);
  });

  it("update and sync: admin only", async () => {
    await expect(updateDirectoryUser(manager, OTHER, { role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(syncDirectoryFromSlack(manager, [])).rejects.toBeInstanceOf(ForbiddenError);
    expect(dir.updateDirectoryRow).not.toHaveBeenCalled();
  });
});

describe("updateDirectoryUser", () => {
  it("validates the patch with field errors", async () => {
    const err = await updateDirectoryUser(admin, OTHER, { dailyNormHours: 0, timezone: "Nowhere/City" }).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(Object.keys(err.fieldErrors).sort()).toEqual(["dailyNormHours", "timezone"]);
  });

  it("blocks self-demotion and self-archive", async () => {
    await expect(updateDirectoryUser(admin, ADMIN, { role: "member" })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(updateDirectoryUser(admin, ADMIN, { isActive: false })).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("writes valid patches and 404s unknown users", async () => {
    await updateDirectoryUser(admin, OTHER, { dailyNormHours: 7.5, ptoAllowanceDays: null });
    expect(dir.updateDirectoryRow).toHaveBeenCalledWith(expect.anything(), OTHER, { dailyNormHours: 7.5, ptoAllowanceDays: null });
    vi.mocked(dir.updateDirectoryRow).mockResolvedValue(undefined);
    await expect(updateDirectoryUser(admin, OTHER, { isActive: false })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("syncDirectoryFromSlack", () => {
  it("inserts new, updates existing, and returns counts", async () => {
    const res = await syncDirectoryFromSlack(admin, [
      { slackUserId: "U1", fullName: "Existing", email: null, avatarUrl: null, timezone: null },
      { slackUserId: "U2", fullName: "New", email: null, avatarUrl: null, timezone: null },
    ]);
    expect(res).toEqual({ created: 1, updated: 1 });
    expect(dir.insertDirectoryUsers).toHaveBeenCalledWith(tx, [expect.objectContaining({ slackUserId: "U2", role: "member" })]);
    expect(dir.updateUserProfileBySlackId).toHaveBeenCalledWith(tx, "U1", { fullName: "Existing" });
  });
});

describe("projects and holidays (admin writes)", () => {
  const project = { name: "DogTeamPro", code: "DTP", monthlyHourCap: 40, isBillable: true, isActive: true };

  it("forbid non-admins", async () => {
    await expect(upsertProject(manager, project)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addHoliday(manager, { holidayDate: "2026-12-25", name: "Christmas" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeHoliday(member, OTHER)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("maps a duplicate project code to a field error; blank code → null", async () => {
    vi.mocked(cat.insertProject).mockRejectedValueOnce(uniqueErr("projects_code_unique"));
    const err = await upsertProject(admin, project).catch((e) => e);
    expect(err.fieldErrors).toEqual({ code: ["Another project already uses this code"] });
    await upsertProject(admin, { ...project, code: "  " });
    expect(cat.insertProject).toHaveBeenLastCalledWith(expect.anything(), { ...project, code: null });
  });

  it("updates by id and 404s a missing project", async () => {
    vi.mocked(cat.updateProject).mockResolvedValue(undefined);
    await expect(upsertProject(admin, { ...project, id: OTHER })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("holidays: duplicate date → field error, bad date → field error, missing id → 404", async () => {
    vi.mocked(cat.insertHoliday).mockRejectedValueOnce(uniqueErr("company_holidays_holiday_date_unique"));
    await expect(addHoliday(admin, { holidayDate: "2026-12-25", name: "Christmas" })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(addHoliday(admin, { holidayDate: "2026-02-30", name: "X" })).rejects.toBeInstanceOf(InvalidInputError);
    vi.mocked(cat.deleteHoliday).mockResolvedValue(false);
    await expect(removeHoliday(admin, OTHER)).rejects.toBeInstanceOf(NotFoundError);
  });
});
