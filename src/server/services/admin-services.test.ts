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
  listProjectRows: vi.fn(),
  findProjectRow: vi.fn(),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  listProjectChannelRows: vi.fn(),
  listHolidayViews: vi.fn(),
  insertHoliday: vi.fn(),
  insertHolidaysSkipExisting: vi.fn(),
  deleteHoliday: vi.fn(),
  listUserHolidayDates: vi.fn(),
}));
vi.mock("@/server/db/queries/office-holiday-entries", () => ({
  insertOfficeHolidayEntries: vi.fn(),
  deleteOfficeHolidayEntries: vi.fn(),
  syncUserOfficeHolidayEntries: vi.fn(),
}));
vi.mock("@/server/db/queries/projects", () => ({
  listProjectMemberRows: vi.fn(),
  isProjectMember: vi.fn(),
  projectExists: vi.fn(),
  findUserIdsBySlackIds: vi.fn(),
  replaceProjectMemberRows: vi.fn(),
}));
vi.mock("@/server/db/queries/offices", () => ({
  listOfficeViews: vi.fn(),
  findOfficeView: vi.fn(),
  officeExists: vi.fn(),
  insertOffice: vi.fn(),
  updateOffice: vi.fn(),
  countOfficeUsage: vi.fn(),
  deleteOfficeRow: vi.fn(),
}));

import * as cat from "@/server/db/queries/catalog";
import * as dir from "@/server/db/queries/directory";
import * as off from "@/server/db/queries/offices";
import * as proj from "@/server/db/queries/projects";
import { listDirectory, syncDirectoryFromSlack, updateDirectoryUser } from "./directory-service";
import { ForbiddenError, InvalidInputError, NotFoundError } from "./errors";
import {
  addHoliday,
  copyHolidays,
  listHolidayDatesForUser,
  listHolidays,
  removeHoliday,
  shiftHolidaysToYear,
} from "./holiday-service";
import { deleteOffice, listOffices, upsertOffice } from "./office-service";
import { assertProjectMember, listProjects, replaceProjectMembers, upsertProject } from "./project-service";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const OFFICE = "55555555-5555-4555-8555-555555555555";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const admin = { userId: ADMIN, role: "admin" as const };
const manager = { userId: ADMIN, role: "manager" as const };
const member = { userId: ADMIN, role: "member" as const };
const KYIV = "Europe/Kyiv";
const PROMPT = { statusPromptTime: "10:00", statusPromptOfficeId: null, hasTimeEntries: false };
const uniqueErr = (constraint: string) => Object.assign(new Error("dup"), { code: "23505", constraint_name: constraint });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dir.listDirectoryUsers).mockResolvedValue([]);
  vi.mocked(dir.updateDirectoryRow).mockResolvedValue({ id: OTHER } as never);
  vi.mocked(dir.findUsersBySlackIds).mockResolvedValue(["U1"]);
  vi.mocked(dir.insertDirectoryUsers).mockResolvedValue(1);
  vi.mocked(dir.updateUserProfileBySlackId).mockResolvedValue(true);
  vi.mocked(cat.deleteHoliday).mockResolvedValue({ officeId: OFFICE, holidayDate: "2026-01-01" });
  vi.mocked(cat.insertProject).mockResolvedValue(PROJECT);
  vi.mocked(cat.updateProject).mockResolvedValue(true);
  vi.mocked(cat.findProjectRow).mockResolvedValue({
    id: PROJECT,
    name: "DogTeamPro",
    isActive: true,
    slackChannelId: "C0123ABCD",
    createdBy: { userId: ADMIN, fullName: "Admin" },
    statusPromptTime: "10:00",
    statusPromptOfficeId: null,
    hasTimeEntries: false,
  });
  vi.mocked(proj.listProjectMemberRows).mockResolvedValue([]);
  vi.mocked(proj.projectExists).mockResolvedValue(true);
  vi.mocked(proj.isProjectMember).mockResolvedValue(true);
  vi.mocked(off.officeExists).mockResolvedValue(true);
  vi.mocked(off.insertOffice).mockResolvedValue(OFFICE);
  vi.mocked(off.updateOffice).mockResolvedValue(true);
  vi.mocked(off.findOfficeView).mockResolvedValue({ id: OFFICE, code: "UA", name: "Ukraine", timezone: "Europe/Kyiv", memberCount: 0 });
  vi.mocked(off.countOfficeUsage).mockResolvedValue({ members: 0, holidays: 0 });
  vi.mocked(off.deleteOfficeRow).mockResolvedValue(true);
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

  it("officeId: null or an existing office; attaches projectIds", async () => {
    vi.mocked(proj.listProjectMemberRows).mockResolvedValue([{ projectId: PROJECT, userId: OTHER, fullName: "Other", avatarUrl: null, allocationHoursPerMonth: 160 }]);
    const user = await updateDirectoryUser(admin, OTHER, { officeId: null });
    expect(dir.updateDirectoryRow).toHaveBeenLastCalledWith(expect.anything(), OTHER, { officeId: null });
    expect(user.projectIds).toEqual([PROJECT]);
    await updateDirectoryUser(admin, OTHER, { officeId: OFFICE });
    expect(dir.updateDirectoryRow).toHaveBeenLastCalledWith(expect.anything(), OTHER, { officeId: OFFICE });
    vi.mocked(off.officeExists).mockResolvedValue(false);
    const err = await updateDirectoryUser(admin, OTHER, { officeId: OFFICE }).catch((e) => e);
    expect(err.fieldErrors).toEqual({ officeId: ["Unknown office"] });
    const bad = await updateDirectoryUser(admin, OTHER, { officeId: "UA" }).catch((e) => e);
    expect(Object.keys(bad.fieldErrors)).toEqual(["officeId"]);
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
      { slackUserId: "U1", fullName: "Existing", email: null, avatarUrl: null, timezone: null, title: "Engineer" },
      { slackUserId: "U2", fullName: "New", email: null, avatarUrl: null, timezone: null, title: null },
    ]);
    expect(res).toEqual({ created: 1, updated: 1 });
    expect(dir.insertDirectoryUsers).toHaveBeenCalledWith(tx, [expect.objectContaining({ slackUserId: "U2", role: "member" })]);
    expect(dir.updateUserProfileBySlackId).toHaveBeenCalledWith(tx, "U1", { fullName: "Existing", title: "Engineer" });
  });
});

describe("projects (A15)", () => {
  const project = { name: "DogTeamPro", slackChannelId: "C0123ABCD" };

  it("forbid non-admins", async () => {
    await expect(upsertProject(manager, project)).rejects.toBeInstanceOf(ForbiddenError);
    expect(cat.insertProject).not.toHaveBeenCalled();
  });

  it("create needs a channel and sets created_by; update keeps created_by", async () => {
    const missing = await upsertProject(admin, { ...project, slackChannelId: " " }).catch((e) => e);
    expect(Object.keys(missing.fieldErrors)).toEqual(["slackChannelId"]);
    const view = await upsertProject(admin, project);
    expect(cat.insertProject).toHaveBeenLastCalledWith(expect.anything(), { ...project, createdBy: ADMIN });
    expect(view).toMatchObject({ id: PROJECT, createdBy: { userId: ADMIN }, memberIds: [], isMember: false });
    await upsertProject(admin, { id: PROJECT, name: "Renamed", slackChannelId: null, isActive: false });
    expect(cat.updateProject).toHaveBeenLastCalledWith(expect.anything(), PROJECT, {
      name: "Renamed",
      slackChannelId: null,
      isActive: false,
    });
  });

  it("validates slackChannelId; duplicate channel → field error", async () => {
    const bad = await upsertProject(admin, { ...project, slackChannelId: "#general" }).catch((e) => e);
    expect(bad).toBeInstanceOf(InvalidInputError);
    expect(Object.keys(bad.fieldErrors)).toEqual(["slackChannelId"]);
    expect(cat.insertProject).not.toHaveBeenCalled();
    vi.mocked(cat.insertProject).mockRejectedValueOnce(uniqueErr("projects_slack_channel_id_unique"));
    const dup = await upsertProject(admin, project).catch((e) => e);
    expect(dup.fieldErrors).toEqual({ slackChannelId: ["This channel is already linked to another project"] });
  });

  it("updates by id and 404s a missing project", async () => {
    vi.mocked(cat.updateProject).mockResolvedValue(false);
    await expect(upsertProject(admin, { ...project, id: OTHER })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("listProjects: everyone sees all, with memberIds and isMember for the actor", async () => {
    vi.mocked(cat.listProjectRows).mockResolvedValue([
      { id: PROJECT, name: "A", isActive: true, slackChannelId: "C0123ABCD", createdBy: null, ...PROMPT },
      { id: OTHER, name: "B", isActive: true, slackChannelId: null, createdBy: null, ...PROMPT },
    ]);
    vi.mocked(proj.listProjectMemberRows).mockResolvedValue([{ projectId: PROJECT, userId: ADMIN, fullName: "Admin", avatarUrl: null, allocationHoursPerMonth: 160 }]);
    const views = await listProjects(member);
    expect(views.map((v) => [v.id, v.memberIds, v.isMember])).toEqual([
      [PROJECT, [ADMIN], true],
      [OTHER, [], false],
    ]);
    expect(cat.listProjectRows).toHaveBeenCalledWith(expect.anything(), false);
  });

  it("replaceProjectMembers maps known Slack ids and counts the rest", async () => {
    vi.mocked(proj.findUserIdsBySlackIds).mockResolvedValue([OTHER]);
    await expect(replaceProjectMembers(PROJECT, ["U1", "U2", "U1", " "])).resolves.toEqual({ members: 1, skipped: 1 });
    expect(proj.findUserIdsBySlackIds).toHaveBeenCalledWith(tx, ["U1", "U2"]);
    expect(proj.replaceProjectMemberRows).toHaveBeenCalledWith(tx, PROJECT, [OTHER]);
    vi.mocked(proj.projectExists).mockResolvedValue(false);
    await expect(replaceProjectMembers(PROJECT, [])).rejects.toBeInstanceOf(NotFoundError);
    await expect(replaceProjectMembers("nope", [])).rejects.toBeInstanceOf(NotFoundError);
  });

  it("assertProjectMember throws { projectId: ['not_member'] } for non-members", async () => {
    await expect(assertProjectMember(OTHER, PROJECT)).resolves.toBeUndefined();
    vi.mocked(proj.isProjectMember).mockResolvedValue(false);
    const err = await assertProjectMember(OTHER, PROJECT).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(err.fieldErrors).toEqual({ projectId: ["not_member"] });
    await expect(assertProjectMember("nope", PROJECT)).rejects.toBeInstanceOf(InvalidInputError);
  });
});

describe("offices (A15)", () => {
  it("list is open to any user; writes are admin only", async () => {
    vi.mocked(off.listOfficeViews).mockResolvedValue([]);
    await expect(listOffices(member)).resolves.toEqual([]);
    await expect(upsertOffice(manager, { code: "UA", name: "Ukraine", timezone: KYIV })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteOffice(member, OFFICE)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("uppercases the code and enforces 2–6 letters; duplicate code → field error", async () => {
    await upsertOffice(admin, { code: " de ", name: "Germany", timezone: "Europe/Berlin" });
    expect(off.insertOffice).toHaveBeenLastCalledWith(expect.anything(), { code: "DE", name: "Germany", timezone: "Europe/Berlin" });
    for (const code of ["U", "UKRAINE", "U1", ""]) {
      const err = await upsertOffice(admin, { code, name: "X", timezone: KYIV }).catch((e) => e);
      expect(Object.keys(err.fieldErrors)).toEqual(["code"]);
    }
    vi.mocked(off.insertOffice).mockRejectedValueOnce(uniqueErr("offices_code_unique"));
    const dup = await upsertOffice(admin, { code: "UA", name: "Ukraine", timezone: KYIV }).catch((e) => e);
    expect(dup.fieldErrors).toEqual({ code: ["Another office already uses this code"] });
    vi.mocked(off.updateOffice).mockResolvedValue(false);
    await expect(upsertOffice(admin, { id: OFFICE, code: "UA", name: "Ukraine", timezone: KYIV })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("delete only when the office has no members and no holidays", async () => {
    vi.mocked(off.countOfficeUsage).mockResolvedValue({ members: 2, holidays: 7 });
    const err = await deleteOffice(admin, OFFICE).catch((e) => e);
    expect(Object.keys(err.fieldErrors).sort()).toEqual(["holidays", "members"]);
    expect(off.deleteOfficeRow).not.toHaveBeenCalled();
    vi.mocked(off.countOfficeUsage).mockResolvedValue({ members: 0, holidays: 0 });
    await deleteOffice(admin, OFFICE);
    expect(off.deleteOfficeRow).toHaveBeenCalledWith(expect.anything(), OFFICE);
    vi.mocked(off.deleteOfficeRow).mockResolvedValue(false);
    await expect(deleteOffice(admin, OFFICE)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteOffice(admin, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("holidays per office (A15)", () => {
  const h = { officeId: OFFICE, holidayDate: "2026-12-25", name: "Різдво Христове" };

  it("forbid non-admins", async () => {
    await expect(addHoliday(manager, h)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeHoliday(member, OTHER)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(copyHolidays(manager, OFFICE, 2026, 2027)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("list filters by office when given", async () => {
    vi.mocked(cat.listHolidayViews).mockResolvedValue([]);
    await listHolidays(member, 2026, OFFICE);
    expect(cat.listHolidayViews).toHaveBeenLastCalledWith(expect.anything(), "2026-01-01", "2026-12-31", OFFICE);
    await listHolidays(member, 2026);
    expect(cat.listHolidayViews).toHaveBeenLastCalledWith(expect.anything(), "2026-01-01", "2026-12-31", undefined);
  });

  it("add: duplicate (office, date) → field error, bad date / unknown office → field error, missing id → 404", async () => {
    vi.mocked(cat.insertHoliday).mockRejectedValueOnce(uniqueErr("company_holidays_office_date_unique"));
    const dup = await addHoliday(admin, h).catch((e) => e);
    expect(Object.keys(dup.fieldErrors)).toEqual(["holidayDate"]);
    await expect(addHoliday(admin, { ...h, holidayDate: "2026-02-30" })).rejects.toBeInstanceOf(InvalidInputError);
    vi.mocked(off.officeExists).mockResolvedValue(false);
    const unknown = await addHoliday(admin, h).catch((e) => e);
    expect(unknown.fieldErrors).toEqual({ officeId: ["Unknown office"] });
    vi.mocked(cat.deleteHoliday).mockResolvedValue(undefined);
    await expect(removeHoliday(admin, OTHER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("add/remove holiday also pre-fills / clears the office's holiday rows for that date", async () => {
    const ohe = await import("@/server/db/queries/office-holiday-entries");
    await addHoliday(admin, { ...h, holidayDate: "2026-05-01" });
    expect(ohe.insertOfficeHolidayEntries).toHaveBeenLastCalledWith(tx, h.officeId, ["2026-05-01"]);
    await removeHoliday(admin, OTHER);
    expect(ohe.deleteOfficeHolidayEntries).toHaveBeenLastCalledWith(tx, OFFICE, ["2026-01-01"]);
  });

  it("shiftHolidaysToYear keeps month/day and drops Feb 29 in a non-leap year", () => {
    const rows = [
      { holidayDate: "2028-01-01", name: "A" },
      { holidayDate: "2028-02-29", name: "B" },
    ];
    expect(shiftHolidaysToYear(rows, 2029)).toEqual({ shifted: [{ holidayDate: "2029-01-01", name: "A" }], invalid: 1 });
  });

  it("copy: same month/day into the target year; existing dates and Feb 29 are skipped", async () => {
    vi.mocked(cat.listHolidayViews).mockResolvedValue([
      { id: "1", officeId: OFFICE, holidayDate: "2028-01-01", name: "Новий рік" },
      { id: "2", officeId: OFFICE, holidayDate: "2028-02-29", name: "Leap" },
      { id: "3", officeId: OFFICE, holidayDate: "2028-12-25", name: "Різдво Христове" },
    ]);
    vi.mocked(cat.insertHolidaysSkipExisting).mockResolvedValue(1); // 12-25 already existed
    await expect(copyHolidays(admin, OFFICE, 2028, 2029)).resolves.toEqual({ copied: 1, skipped: 2 });
    expect(cat.listHolidayViews).toHaveBeenCalledWith(expect.anything(), "2028-01-01", "2028-12-31", OFFICE);
    expect(cat.insertHolidaysSkipExisting).toHaveBeenCalledWith(expect.anything(), [
      { officeId: OFFICE, holidayDate: "2029-01-01", name: "Новий рік" },
      { officeId: OFFICE, holidayDate: "2029-12-25", name: "Різдво Христове" },
    ]);
    await expect(copyHolidays(admin, OFFICE, 2026, 2026)).rejects.toBeInstanceOf(InvalidInputError);
    vi.mocked(off.officeExists).mockResolvedValue(false);
    await expect(copyHolidays(admin, OFFICE, 2026, 2027)).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("listHolidayDatesForUser: system read; unknown id → []", async () => {
    vi.mocked(cat.listUserHolidayDates).mockResolvedValue(["2026-12-25"]);
    await expect(listHolidayDatesForUser(OTHER, "2026-12-01", "2026-12-31")).resolves.toEqual(["2026-12-25"]);
    await expect(listHolidayDatesForUser("nope", "2026-12-01", "2026-12-31")).resolves.toEqual([]);
    await expect(listHolidayDatesForUser(OTHER, "2026-13-01", "2026-12-31")).rejects.toBeInstanceOf(RangeError);
  });
});
