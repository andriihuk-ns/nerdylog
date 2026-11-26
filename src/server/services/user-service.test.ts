import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { db: true };
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
vi.mock("@/server/db/queries/users", () => ({
  findActiveActorByAuthUserId: vi.fn(),
  findActiveProfileBySlackUserId: vi.fn(),
  findMyProfileById: vi.fn(),
  upsertUserBySlackId: vi.fn(),
}));

import * as q from "@/server/db/queries/users";
import { NotFoundError } from "./errors";
import { getMyProfile } from "./user-service";

const ME = "11111111-1111-4111-8111-111111111111";
const profile = {
  userId: ME,
  role: "member" as const,
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
  title: "Product Designer",
  timezone: "Europe/Lisbon",
};

beforeEach(() => vi.clearAllMocks());

describe("getMyProfile", () => {
  it("returns the actor's own profile, looked up by actor.userId", async () => {
    vi.mocked(q.findMyProfileById).mockResolvedValue(profile);
    await expect(getMyProfile({ userId: ME, role: "member" })).resolves.toEqual(profile);
    expect(q.findMyProfileById).toHaveBeenCalledWith(db, ME);
  });

  it("throws NotFoundError when the row is missing", async () => {
    vi.mocked(q.findMyProfileById).mockResolvedValue(undefined);
    await expect(getMyProfile({ userId: ME, role: "admin" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
