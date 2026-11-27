import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/queries/users", () => ({ findPtoAllowance: vi.fn(), listActiveRollupUsers: vi.fn() }));
vi.mock("@/server/db/queries/time-entries", () => ({
  listUserPtoDates: vi.fn(),
  listEntriesInRange: vi.fn(),
}));
vi.mock("@/server/db/queries/projects", () => ({ listProjectNames: vi.fn() }));

import { listUserPtoDates } from "@/server/db/queries/time-entries";
import { findPtoAllowance } from "@/server/db/queries/users";
import { ForbiddenError, NotFoundError } from "./errors";
import { getPtoBalance } from "./pto-service";

const member = { userId: "u-member", role: "member" as const };
const manager = { userId: "u-manager", role: "manager" as const };
const admin = { userId: "u-admin", role: "admin" as const };

beforeEach(() => {
  vi.mocked(findPtoAllowance).mockReset().mockResolvedValue({ allowanceDays: 20, sickAllowanceDays: 10 });
  vi.mocked(listUserPtoDates)
    .mockReset()
    .mockResolvedValue([{ workDate: "2026-03-02", entryType: "vacation" }]);
});

describe("getPtoBalance RBAC (A5)", () => {
  it("lets a member read their own balance for the calendar year", async () => {
    const b = await getPtoBalance(member, "u-member", 2026);
    expect(b.remainingDays).toBe(19);
    expect(listUserPtoDates).toHaveBeenCalledWith({}, "u-member", "2026-01-01", "2026-12-31");
  });

  it("forbids a member from reading another user and never queries", async () => {
    await expect(getPtoBalance(member, "u-other", 2026)).rejects.toBeInstanceOf(ForbiddenError);
    expect(findPtoAllowance).not.toHaveBeenCalled();
    expect(listUserPtoDates).not.toHaveBeenCalled();
  });

  it("lets managers and admins read anyone", async () => {
    await expect(getPtoBalance(manager, "u-other", 2026)).resolves.toMatchObject({ userId: "u-other" });
    await expect(getPtoBalance(admin, "u-other", 2026)).resolves.toMatchObject({ userId: "u-other" });
  });

  it("throws NotFoundError for an unknown user", async () => {
    vi.mocked(findPtoAllowance).mockResolvedValue(undefined);
    await expect(getPtoBalance(admin, "u-missing", 2026)).rejects.toBeInstanceOf(NotFoundError);
  });
});
