import { describe, expect, it } from "vitest";
import {
  checklistSearchText,
  checklistToText,
  parseChecklist,
  serializeChecklist,
  taskSummaryDisplayText,
  textToChecklist,
} from "./checklist";

describe("checklist helpers", () => {
  it("parses valid checklist JSON and returns null for plain text", () => {
    expect(parseChecklist("plain note")).toBeNull();
    expect(parseChecklist("[invalid json")).toBeNull();
    const json = serializeChecklist([
      { text: "Fix login", done: true, link: "https://github.com/org/repo/pull/1" },
      { text: "Write tests", done: false },
    ]);
    expect(parseChecklist(json)).toEqual([
      { text: "Fix login", done: true, link: "https://github.com/org/repo/pull/1" },
      { text: "Write tests", done: false },
    ]);
  });

  it("converts plain multiline/bulleted text into checklist items", () => {
    expect(textToChecklist("- First task\n[x] Second task\nThird task")).toEqual([
      { text: "First task", done: false },
      { text: "Second task", done: true },
      { text: "Third task", done: false },
    ]);
    expect(textToChecklist("")).toEqual([{ text: "", done: false }]);
  });

  it("formats checklist items as bulleted text and preserves plain text", () => {
    const json = serializeChecklist([
      { text: "Review PR", done: true, link: "https://github.com/a/b/pull/2" },
      { text: "Deploy", done: false },
    ]);
    expect(checklistToText(parseChecklist(json)!)).toBe(
      "[x] Review PR (https://github.com/a/b/pull/2)\n• Deploy",
    );
    expect(taskSummaryDisplayText(json)).toBe(
      "[x] Review PR (https://github.com/a/b/pull/2)\n• Deploy",
    );
    expect(taskSummaryDisplayText("Legacy plain note")).toBe("Legacy plain note");
    expect(checklistSearchText(parseChecklist(json)!)).toContain("https://github.com/a/b/pull/2");
  });
});

