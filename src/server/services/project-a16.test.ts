import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = { tx: true };
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ transaction: (fn: (t: unknown) => unknown) => fn(tx) }),
}));
vi.mock("@/server/db/queries/catalog", () => ({
  listProjectRows: vi.fn(),
  findProjectRow: vi.fn(),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock("@/server/db/queries/projects", () => ({
  listProjectMemberRows: vi.fn(),
  isProjectMember: vi.fn(),
  projectExists: vi.fn(),
  projectHasTimeEntries: vi.fn(),
  deleteProjectRow: vi.fn(),
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
import * as off from "@/server/db/queries/offices";
import * as proj from "@/server/db/queries/projects";
import { ForbiddenError, InvalidInputError, NotFoundError } from "./errors";
import { listOffices, upsertOffice } from "./office-service";
import { deleteProject, listProjects, upsertProject } from "./project-service";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const OFFICE = "55555555-5555-4555-8555-555555555555";
const admin = { userId: ADMIN, role: "admin" as const };
const manager = { userId: ADMIN, role: "manager" as const };
const row = {
  id: PROJECT,
  name: "DogTeamPro",
  isActive: true,
  slackChannelId: "C0123ABCD",
  createdBy: null,
  statusPromptTime: "09:15",
  statusPromptOfficeId: OFFICE,
  statusPromptTimezone: null,
  hasTimeEntries: true,
};
const fkErr = (constraint: string) =>
  new Error("Failed query", { cause: { code: "23503", constraint_name: constraint } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cat.listProjectRows).mockResolvedValue([row]);
  vi.mocked(cat.findProjectRow).mockResolvedValue(row);
  vi.mocked(cat.insertProject).mockResolvedValue(PROJECT);
  vi.mocked(cat.updateProject).mockResolvedValue(true);
  vi.mocked(proj.listProjectMemberRows).mockResolvedValue([]);
  vi.mocked(proj.projectExists).mockResolvedValue(true);
  vi.mocked(proj.projectHasTimeEntries).mockResolvedValue(false);
  vi.mocked(proj.deleteProjectRow).mockResolvedValue(true);
  vi.mocked(off.officeExists).mockResolvedValue(true);
  vi.mocked(off.insertOffice).mockResolvedValue(OFFICE);
  vi.mocked(off.findOfficeView).mockResolvedValue({ id: OFFICE, code: "PL", name: "Poland", timezone: "Europe/Warsaw", memberCount: 0 });
});

describe("project status prompt fields (A16)", () => {
  it("listProjects passes prompt time, office and hasTimeEntries through", async () => {
    const [view] = await listProjects(admin);
    expect(view).toMatchObject({ statusPromptTime: "09:15", statusPromptOfficeId: OFFICE, hasTimeEntries: true });
  });

  it("upsert trims and stores a valid HH:MM and office; omitted fields stay unset", async () => {
    await upsertProject(admin, { name: "A", slackChannelId: "C0123ABCD", statusPromptTime: " 09:15 ", statusPromptOfficeId: OFFICE });
    expect(cat.insertProject).toHaveBeenLastCalledWith(expect.anything(), {
      name: "A",
      slackChannelId: "C0123ABCD",
      statusPromptTime: "09:15",
      statusPromptOfficeId: OFFICE,
      createdBy: ADMIN,
    });
    await upsertProject(admin, { id: PROJECT, name: "A", slackChannelId: null, statusPromptOfficeId: null });
    expect(cat.updateProject).toHaveBeenLastCalledWith(expect.anything(), PROJECT, {
      name: "A",
      slackChannelId: null,
      statusPromptOfficeId: null,
    });
    expect(off.officeExists).toHaveBeenCalledTimes(1); // null office needs no lookup
  });

  it.each(["24:00", "9:15", "10:60", "10:00:00", "", "ab:cd"])("rejects prompt time %j", async (statusPromptTime) => {
    const err = await upsertProject(admin, { name: "A", slackChannelId: "C0123ABCD", statusPromptTime }).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(Object.keys(err.fieldErrors)).toEqual(["statusPromptTime"]);
  });

  it("accepts the edges 00:00 and 23:59", async () => {
    await upsertProject(admin, { name: "A", slackChannelId: "C0123ABCD", statusPromptTime: "00:00" });
    await upsertProject(admin, { name: "A", slackChannelId: "C0123ABCD", statusPromptTime: "23:59" });
    expect(cat.insertProject).toHaveBeenCalledTimes(2);
  });

  it("unknown or malformed office → field error; FK race → same field error", async () => {
    vi.mocked(off.officeExists).mockResolvedValueOnce(false);
    const unknown = await upsertProject(admin, { name: "A", slackChannelId: "C0123ABCD", statusPromptOfficeId: OFFICE }).catch((e) => e);
    expect(unknown.fieldErrors).toEqual({ statusPromptOfficeId: ["Unknown office"] });
    const bad = await upsertProject(admin, { name: "A", slackChannelId: "C0123ABCD", statusPromptOfficeId: "nope" }).catch((e) => e);
    expect(Object.keys(bad.fieldErrors)).toEqual(["statusPromptOfficeId"]);
    vi.mocked(cat.insertProject).mockRejectedValueOnce(fkErr("projects_status_prompt_office_id_offices_id_fk"));
    const race = await upsertProject(admin, { name: "A", slackChannelId: "C0123ABCD", statusPromptOfficeId: OFFICE }).catch((e) => e);
    expect(race.fieldErrors).toEqual({ statusPromptOfficeId: ["Unknown office"] });
  });
});

describe("deleteProject (A16)", () => {
  it("admin only", async () => {
    await expect(deleteProject(manager, PROJECT)).rejects.toBeInstanceOf(ForbiddenError);
    expect(proj.deleteProjectRow).not.toHaveBeenCalled();
  });

  it("deletes a project without entries inside one transaction", async () => {
    await deleteProject(admin, PROJECT);
    expect(proj.projectHasTimeEntries).toHaveBeenCalledWith(tx, PROJECT);
    expect(proj.deleteProjectRow).toHaveBeenCalledWith(tx, PROJECT);
  });

  it("has entries → InvalidInputError { _: ['has_entries'] }, nothing deleted", async () => {
    vi.mocked(proj.projectHasTimeEntries).mockResolvedValue(true);
    const err = await deleteProject(admin, PROJECT).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(err.fieldErrors).toEqual({ _: ["has_entries"] });
    expect(proj.deleteProjectRow).not.toHaveBeenCalled();
  });

  it("an entry written between check and delete (FK restrict) → has_entries", async () => {
    vi.mocked(proj.deleteProjectRow).mockRejectedValue(fkErr("time_entries_project_id_projects_id_fk"));
    const err = await deleteProject(admin, PROJECT).catch((e) => e);
    expect(err.fieldErrors).toEqual({ _: ["has_entries"] });
  });

  it("missing or malformed id → NotFoundError", async () => {
    await expect(deleteProject(admin, "nope")).rejects.toBeInstanceOf(NotFoundError);
    vi.mocked(proj.projectExists).mockResolvedValue(false);
    await expect(deleteProject(admin, PROJECT)).rejects.toBeInstanceOf(NotFoundError);
    expect(proj.deleteProjectRow).not.toHaveBeenCalled();
  });
});

describe("office timezone (A16)", () => {
  it("stores a real IANA zone and returns it", async () => {
    const view = await upsertOffice(admin, { code: "pl", name: "Poland", timezone: " Europe/Warsaw " });
    expect(off.insertOffice).toHaveBeenLastCalledWith(expect.anything(), { code: "PL", name: "Poland", timezone: "Europe/Warsaw" });
    expect(view.timezone).toBe("Europe/Warsaw");
  });

  it.each(["", "Nowhere/City", "GMT+25"])("rejects timezone %j", async (timezone) => {
    const err = await upsertOffice(admin, { code: "PL", name: "Poland", timezone }).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(Object.keys(err.fieldErrors)).toEqual(["timezone"]);
    expect(off.insertOffice).not.toHaveBeenCalled();
  });

  it("listOffices returns the timezone", async () => {
    vi.mocked(off.listOfficeViews).mockResolvedValue([{ id: OFFICE, code: "UA", name: "Ukraine", timezone: "Europe/Kyiv", memberCount: 3 }]);
    await expect(listOffices(admin)).resolves.toEqual([expect.objectContaining({ timezone: "Europe/Kyiv" })]);
  });
});
