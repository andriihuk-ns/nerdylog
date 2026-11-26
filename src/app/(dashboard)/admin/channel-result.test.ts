import { describe, expect, it } from "vitest";
import { InvalidInputError } from "@/server/services/errors";
import { channelFieldError, fromJoinResult } from "./channel-result";

describe("fromJoinResult", () => {
  it("returns null when the bot is in the channel", () => {
    expect(fromJoinResult({ ok: true })).toBeNull();
  });

  it("keeps the reason so the UI can name the invite fix", () => {
    expect(fromJoinResult({ ok: false, reason: "private_needs_invite", message: "invite first" })).toEqual({
      ok: false,
      field: "slackChannelId",
      reason: "private_needs_invite",
      message: "invite first",
    });
  });
});

describe("channelFieldError", () => {
  it("maps the slackChannelId field error to an inline failure", () => {
    const err = InvalidInputError.field("slackChannelId", "This channel is already linked to another project");
    expect(channelFieldError(err)).toEqual({
      ok: false,
      field: "slackChannelId",
      message: "This channel is already linked to another project",
    });
  });

  it("ignores other fields and other errors", () => {
    expect(channelFieldError(InvalidInputError.field("code", "Another project already uses this code"))).toBeNull();
    expect(channelFieldError(new Error("boom"))).toBeNull();
    expect(channelFieldError("nope")).toBeNull();
  });
});
