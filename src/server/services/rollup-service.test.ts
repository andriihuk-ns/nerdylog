import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/queries/users", () => ({ listActiveRollupUsers: vi.fn() }));
vi.mock("@/server/db/queries/time-entries", () => ({ listEntriesInRange: vi.fn() }));
vi.mock("@/server/db/queries/projects", () => ({ listProjectNames: vi.fn() }));

import { listProjectNames } from "@/server/db/queries/projects";
import { listEntriesInRange } from "@/server/db/queries/time-entries";
import { ForbiddenError } from "./errors";
import { getProjectHours } from "./rollup-service";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listEntriesInRange).mockResolvedValue([
    { userId: OTHER, workDate: "2026-11-02", hours: 4, entryType: "work", projectId: P1 },
    { userId: OTHER, workDate: "2026-11-03", hours: 0, entryType: "sick", projectId: null },
  ]);
  vi.mocked(listProjectNames).mockResolvedValue([{ id: P1, name: "DogTeamPro" }]);
});

describe("getProjectHours (A15)", () => {
  it("member: own hours only (default userId = actor)", async () => {
    await getProjectHours({ userId: ME, role: "member" }, "2026-11");
    expect(listEntriesInRange).toHaveBeenCalledWith({}, { start: "2026-11-01", end: "2026-11-30", userIds: [ME] });
    await expect(getProjectHours({ userId: ME, role: "member" }, "2026-11", OTHER)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("manager/admin: any user; names come from the projects that have hours", async () => {
    const rows = await getProjectHours({ userId: ME, role: "manager" }, "2026-11", OTHER);
    expect(listProjectNames).toHaveBeenCalledWith({}, [P1]);
    expect(rows).toEqual([{ projectId: P1, projectName: "DogTeamPro", month: "2026-11", hours: 4 }]);
  });

  it("rejects a malformed month", async () => {
    await expect(getProjectHours({ userId: ME, role: "admin" }, "2026-13")).rejects.toThrow();
  });
});
