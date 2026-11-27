import { describe, expect, it } from "vitest";
import { serializeChecklist, type MorningReminderTarget } from "@/contracts";
import { buildMorningReminder } from "./morning-reminder";

function textFor(taskSummary: string): string {
  const target: MorningReminderTarget = {
    userId: "u1",
    slackUserId: "U1",
    locale: "en",
    logDate: "2026-11-26",
    pingDate: "2026-11-27",
    entries: [{ entryType: "work", projectName: "Alpha", hours: 4, taskSummary }],
  };
  return buildMorningReminder(target).text;
}

describe("buildMorningReminder task text", () => {
  it("shows a single checklist task as text on the project line, never as JSON", () => {
    const text = textFor(serializeChecklist([{ text: "Fix (https://react.dev) login", done: false }]));
    expect(text).toContain("· Fix (https://react.dev) login");
    expect(text).not.toContain('"text"');
  });

  it("lists several tasks on their own lines with field links after the text", () => {
    const text = textFor(
      serializeChecklist([
        { text: "Review", done: true, link: "https://github.com/a/b/pull/2" },
        { text: "Deploy", done: false },
      ]),
    );
    expect(text).toContain("\n    [x] Review (https://github.com/a/b/pull/2)\n    • Deploy");
  });

  it("keeps legacy plain text and falls back when there is no task", () => {
    expect(textFor("Legacy note")).toContain("· Legacy note");
    expect(textFor(serializeChecklist([{ text: "", done: false }]))).not.toContain("[{");
    expect(textFor("")).not.toMatch(/· $/);
  });
});
