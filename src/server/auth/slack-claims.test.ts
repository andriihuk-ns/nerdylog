import { describe, expect, it } from "vitest";
import { isAllowedSlackTeam, slackClaimsFromUser, slackIdentityFromUser } from "./slack-claims";

const AUTH_ID = "0b7c3f5e-2a1d-4c6b-9e8f-1a2b3c4d5e6f";

describe("slackIdentityFromUser", () => {
  it("maps custom_claims from slack_oidc user_metadata", () => {
    const identity = slackIdentityFromUser({
      id: AUTH_ID,
      email: "dev@example.com",
      user_metadata: {
        name: "Dev Person",
        picture: "https://avatars.slack-edge.com/a.png",
        custom_claims: { "https://slack.com/user_id": "U012ABC", "https://slack.com/team_id": "T1" },
      },
    });
    expect(identity).toEqual({
      authUserId: AUTH_ID,
      slackUserId: "U012ABC",
      email: "dev@example.com",
      fullName: "Dev Person",
      avatarUrl: "https://avatars.slack-edge.com/a.png",
      timezone: null,
      title: null, // A12: OIDC has no title claim; the callback fills it from users.info
    });
  });

  it("falls back to identity_data and avatar_url", () => {
    const identity = slackIdentityFromUser({
      id: AUTH_ID,
      user_metadata: {},
      identities: [
        {
          provider: "slack_oidc",
          identity_data: { "https://slack.com/user_id": "U09ZZZZZZ9", email: "x@example.com", avatar_url: "https://a.test/p.png" },
        },
      ],
    });
    expect(identity).toMatchObject({ slackUserId: "U09ZZZZZZ9", email: "x@example.com", avatarUrl: "https://a.test/p.png", fullName: "" });
  });

  it("reads the member id from provider_id/sub, the layout Supabase slack_oidc really uses", () => {
    const meta = {
      iss: "https://slack.com",
      sub: "U02REAL0001",
      provider_id: "U02REAL0001",
      name: "Real Person",
      email: "real@example.test",
      picture: "https://avatars.slack-edge.com/a.png",
      custom_claims: { "https://slack.com/team_id": "T22GNB03G" },
    };
    const claims = slackClaimsFromUser({
      id: AUTH_ID,
      email: "real@example.test",
      user_metadata: meta,
      identities: [{ provider: "slack_oidc", identity_data: meta }],
    });
    expect(claims?.identity.slackUserId).toBe("U02REAL0001");
    expect(claims?.teamId).toBe("T22GNB03G");
  });

  it("ignores a sub that is not a Slack member id", () => {
    expect(slackIdentityFromUser({ id: AUTH_ID, user_metadata: { sub: "some-oidc-subject" } })).toBeNull();
  });

  it("returns null without a Slack user id", () => {
    expect(slackIdentityFromUser({ id: AUTH_ID, email: "a@example.com", user_metadata: { name: "A" } })).toBeNull();
  });

  it("drops an invalid avatar URL and email instead of failing", () => {
    const identity = slackIdentityFromUser({
      id: AUTH_ID,
      email: null,
      user_metadata: { custom_claims: { "https://slack.com/user_id": "U01AAAAAA1" }, picture: "javascript:alert(1)" },
    });
    expect(identity).toMatchObject({ slackUserId: "U01AAAAAA1", email: null, avatarUrl: null });
  });

  it("returns null when the auth id is not a uuid", () => {
    expect(slackIdentityFromUser({ id: "nope", user_metadata: { "https://slack.com/user_id": "U01AAAAAA1" } })).toBeNull();
  });
});

describe("slackClaimsFromUser + isAllowedSlackTeam (workspace check)", () => {
  const TEAM = "T0TEMPO01";
  const userWithTeam = (team?: string) => ({
    id: AUTH_ID,
    user_metadata: {
      custom_claims: { "https://slack.com/user_id": "U01AAAAAA1", ...(team ? { "https://slack.com/team_id": team } : {}) },
    },
  });

  it("accepts a token from the configured workspace", () => {
    const claims = slackClaimsFromUser(userWithTeam(TEAM));
    expect(claims?.teamId).toBe(TEAM);
    expect(claims?.identity.slackUserId).toBe("U01AAAAAA1");
    expect(isAllowedSlackTeam(claims?.teamId, TEAM)).toBe(true);
  });

  it("rejects a token from another workspace", () => {
    const claims = slackClaimsFromUser(userWithTeam("T0OTHER99"));
    expect(claims?.teamId).toBe("T0OTHER99");
    expect(isAllowedSlackTeam(claims?.teamId, TEAM)).toBe(false);
  });

  it("rejects a token without a team claim", () => {
    const claims = slackClaimsFromUser(userWithTeam());
    expect(claims?.teamId).toBeNull();
    expect(isAllowedSlackTeam(claims?.teamId, TEAM)).toBe(false);
  });

  it("reads the team claim from top-level user_metadata", () => {
    const claims = slackClaimsFromUser({
      id: AUTH_ID,
      user_metadata: { "https://slack.com/user_id": "U01AAAAAA1", "https://slack.com/team_id": TEAM },
    });
    expect(claims?.teamId).toBe(TEAM);
  });

  it("falls back to slack_oidc identity_data for the team claim", () => {
    const claims = slackClaimsFromUser({
      id: AUTH_ID,
      user_metadata: {},
      identities: [
        { provider: "github", identity_data: { "https://slack.com/team_id": "T0OTHER99" } },
        { provider: "slack_oidc", identity_data: { "https://slack.com/user_id": "U09ZZZZZZ9", "https://slack.com/team_id": TEAM } },
      ],
    });
    expect(claims?.teamId).toBe(TEAM);
    expect(isAllowedSlackTeam(claims?.teamId, TEAM)).toBe(true);
  });

  it("returns null when there is no valid identity", () => {
    expect(slackClaimsFromUser({ id: AUTH_ID, user_metadata: { "https://slack.com/team_id": TEAM } })).toBeNull();
  });

  it("never matches on empty values", () => {
    expect(isAllowedSlackTeam("", "")).toBe(false);
    expect(isAllowedSlackTeam(null, TEAM)).toBe(false);
    expect(isAllowedSlackTeam(undefined, TEAM)).toBe(false);
    expect(isAllowedSlackTeam(TEAM.toLowerCase(), TEAM)).toBe(false);
  });
});
