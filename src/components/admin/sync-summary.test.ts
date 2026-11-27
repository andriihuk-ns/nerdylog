import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import { syncSummary, type SyncTranslate } from "./sync-summary";

const t = createTranslator({ locale: "en", messages: en, namespace: "admin.directory" }) as unknown as SyncTranslate;

describe("syncSummary", () => {
  it("reports people only when no project has a channel", () => {
    const text = syncSummary({ people: { created: 2, updated: 10 }, projects: { refreshed: 0, failed: 0, needsInvite: 0, members: 0 } }, t);
    expect(text).toBe("Synced from Slack: 12 people (2 new).");
  });

  it("adds refreshed and failed project counts", () => {
    const text = syncSummary({ people: { created: 0, updated: 1 }, projects: { refreshed: 3, failed: 1, needsInvite: 0, members: 9 } }, t);
    expect(text).toBe("Synced from Slack: 1 person · members of 3 projects refreshed (1 failed).");
  });

  it("counts projects whose channel needs the bot invited", () => {
    const text = syncSummary({ people: { created: 0, updated: 1 }, projects: { refreshed: 1, failed: 0, needsInvite: 2, members: 4 } }, t);
    expect(text).toBe("Synced from Slack: 1 person · members of 1 project refreshed · 2 need @nerdylog invited to their channel.");
  });
});
