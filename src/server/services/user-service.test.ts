import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { db: true };
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
vi.mock("@/server/db/queries/users", () => ({
  findActiveActorByAuthUserId: vi.fn(),
  findActiveProfileBySlackUserId: vi.fn(),
  findMyProfileById: vi.fn(),
  updateUserLocale: vi.fn(),
  upsertUserBySlackId: vi.fn(),
}));

import * as q from "@/server/db/queries/users";
import { InvalidInputError, NotFoundError } from "./errors";
import { getMyProfile, setMyLocale } from "./user-service";

const ME = "11111111-1111-4111-8111-111111111111";
const profile = {
  userId: ME,
  role: "member" as const,
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
  title: "Product Designer",
  timezone: "Europe/Lisbon",
  locale: "en" as const,
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

describe("setMyLocale", () => {
  it("writes the locale to the actor's own row only", async () => {
    vi.mocked(q.updateUserLocale).mockResolvedValue(true);
    await setMyLocale({ userId: ME, role: "admin" }, "en");
    expect(q.updateUserLocale).toHaveBeenCalledWith(db, ME, "en");
  });

  it("rejects an unsupported locale without touching the DB", async () => {
    await expect(setMyLocale({ userId: ME, role: "member" }, "de" as never)).rejects.toBeInstanceOf(InvalidInputError);
    expect(q.updateUserLocale).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the row is missing", async () => {
    vi.mocked(q.updateUserLocale).mockResolvedValue(false);
    await expect(setMyLocale({ userId: ME, role: "member" }, "uk")).rejects.toBeInstanceOf(NotFoundError);
  });
});
