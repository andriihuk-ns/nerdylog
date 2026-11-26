import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const AUTH_ID = "0b7c3f5e-2a1d-4c6b-9e8f-1a2b3c4d5e6f";
const TEAM = "T0TEMPO01";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  upsertUserFromSlack: vi.fn(),
  fetchSlackTitleWithTimeout: vi.fn(),
}));

vi.mock("@/server/slack/profile", () => ({ fetchSlackTitleWithTimeout: mocks.fetchSlackTitleWithTimeout }));

vi.mock("@/server/auth/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession, signOut: mocks.signOut },
  }),
}));

vi.mock("@/server/services/user-service", () => ({
  InactiveUserError: class InactiveUserError extends Error {},
  upsertUserFromSlack: mocks.upsertUserFromSlack,
}));

vi.mock("@/lib/env", () => ({ serverEnv: () => ({ SLACK_TEAM_ID: TEAM }) }));

import { GET } from "./route";

function userWithTeam(team?: string) {
  return {
    id: AUTH_ID,
    email: "dev@example.com",
    user_metadata: {
      custom_claims: { "https://slack.com/user_id": "U01AAAAAA1", ...(team ? { "https://slack.com/team_id": team } : {}) },
    },
  };
}

async function callback(user: unknown, next = "/team") {
  mocks.exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null });
  const res = await GET(new NextRequest(`https://tempo.test/auth/callback?code=abc&next=${encodeURIComponent(next)}`));
  return new URL(res.headers.get("location") ?? "");
}

describe("GET /auth/callback workspace check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertUserFromSlack.mockResolvedValue(undefined);
    mocks.fetchSlackTitleWithTimeout.mockResolvedValue(null);
  });

  it("links the user and redirects to next for the configured workspace", async () => {
    const loc = await callback(userWithTeam(TEAM));
    expect(loc.pathname).toBe("/team");
    expect(mocks.upsertUserFromSlack).toHaveBeenCalledOnce();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it.each([["another workspace", "T0OTHER99"], ["missing team claim", undefined]])(
    "signs out without creating a user for %s",
    async (_label, team) => {
      const loc = await callback(userWithTeam(team));
      expect(loc.pathname).toBe("/login");
      expect(loc.searchParams.get("error")).toBe("wrong_workspace");
      expect(mocks.signOut).toHaveBeenCalledOnce();
      expect(mocks.upsertUserFromSlack).not.toHaveBeenCalled();
      expect(mocks.fetchSlackTitleWithTimeout).not.toHaveBeenCalled();
    },
  );

  it("passes the Slack profile title into the identity", async () => {
    mocks.fetchSlackTitleWithTimeout.mockResolvedValue("Product Designer");
    const loc = await callback(userWithTeam(TEAM));
    expect(loc.pathname).toBe("/team");
    expect(mocks.fetchSlackTitleWithTimeout).toHaveBeenCalledWith("U01AAAAAA1");
    expect(mocks.upsertUserFromSlack).toHaveBeenCalledWith(
      expect.objectContaining({ slackUserId: "U01AAAAAA1", title: "Product Designer" }),
    );
  });

  it("still signs in with title null when the lookup fails or times out", async () => {
    mocks.fetchSlackTitleWithTimeout.mockResolvedValue(null); // the helper maps errors/timeouts to null
    const loc = await callback(userWithTeam(TEAM));
    expect(loc.pathname).toBe("/team");
    expect(mocks.upsertUserFromSlack).toHaveBeenCalledWith(expect.objectContaining({ title: null }));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("does not follow an open redirect in next", async () => {
    const loc = await callback(userWithTeam(TEAM), "/\t/evil.example");
    expect(loc.origin).toBe("https://tempo.test");
    expect(loc.pathname).toBe("/my-time");
  });
});
