import { describe, expect, it } from "vitest";
import { extractArtifactLinks, inlineLinks, parseArtifactLink, removeInlineLink, replaceInlineLink, segmentTextWithLinks } from "./links";

describe("parseArtifactLink", () => {
  it.each([
    ["https://nerdysoft.atlassian.net/browse/DOG-1364", "jira", "DOG-1364"],
    ["https://nerdysoft.atlassian.net/jira/software/projects/DOG/boards/1?selectedIssue=DOG-77", "jira", "DOG-77"],
    ["https://nerdysoft.atlassian.net/wiki/spaces/ENG/pages/123/Release-checklist", "confluence", "Release checklist"],
    ["https://www.figma.com/design/gpkTkTrGh6BvVAS4FcRXOg/Map-modal-v2?node-id=1-42", "figma", "Map modal v2"],
    ["https://app.asana.com/0/1203456789012345/1209876543210987/f", "asana", "Task 210987"],
    ["https://docs.google.com/document/d/abc/edit", "google-doc", "Doc"],
    ["https://docs.google.com/spreadsheets/d/abc/edit#gid=0", "google-sheet", "Sheet"],
    ["https://docs.google.com/presentation/d/abc/edit", "google-slides", "Slides"],
    ["https://drive.google.com/drive/folders/abc", "google-drive", "Folder"],
    ["https://drive.google.com/file/d/abc/view", "google-drive", "File"],
    ["https://github.com/andriihuk-ns/nerdylog/pull/42", "github", "nerdylog#42"],
    ["https://linear.app/acme/issue/ABC-12/fix-login", "linear", "ABC-12"],
    ["https://www.notion.so/acme/Sprint-plan-0123456789abcdef0123456789abcdef", "notion", "Sprint plan"],
    ["https://www.loom.com/share/abc", "loom", "Video"],
    ["https://example.com/a/b", "web", "example.com"],
  ])("%s → %s %s", (url, provider, label) => {
    const link = parseArtifactLink(url);
    expect(link.provider).toBe(provider);
    expect(link.label).toBe(label);
  });

  it("exposes Jira and Linear issue keys", () => {
    expect(parseArtifactLink("https://x.atlassian.net/browse/CNG-009").issueKey).toBe("CNG-009");
    expect(parseArtifactLink("https://www.figma.com/design/k/Name").issueKey).toBeUndefined();
  });
});

describe("extractArtifactLinks / segmentTextWithLinks", () => {
  const text = "Map modal (https://www.figma.com/design/k/Map-modal), see https://x.atlassian.net/browse/DOG-1. Done.";

  it("finds links without trailing punctuation and de-duplicates", () => {
    const links = extractArtifactLinks(`${text} again https://x.atlassian.net/browse/DOG-1`);
    expect(links.map((l) => l.label)).toEqual(["Map modal", "DOG-1"]);
  });

  it("splits text into text and link segments", () => {
    const segs = segmentTextWithLinks(text);
    expect(segs.map((s) => s.type)).toEqual(["text", "link", "text", "link", "text"]);
    expect(segs[0]).toEqual({ type: "text", text: "Map modal (" });
    expect(segs.at(-1)).toEqual({ type: "text", text: ". Done." });
  });

  it("returns the text unchanged when there are no links", () => {
    expect(segmentTextWithLinks("plain")).toEqual([{ type: "text", text: "plain" }]);
  });
});

describe("typed links (A36)", () => {
  const text = "Overhaul (https://www.figma.com/), moved to React (https://react.dev/) and https://a.dev/x.";

  it("lists URLs as written, in order", () => {
    expect(inlineLinks(text)).toEqual(["https://www.figma.com/", "https://react.dev/", "https://a.dev/x"]);
  });

  it("removes one URL with its wrapping brackets and gap", () => {
    expect(removeInlineLink(text, 0)).toBe("Overhaul, moved to React (https://react.dev/) and https://a.dev/x.");
    expect(removeInlineLink(text, 2)).toBe("Overhaul (https://www.figma.com/), moved to React (https://react.dev/) and.");
  });

  it("keeps line breaks and ignores a missing index", () => {
    expect(removeInlineLink("https://a.dev first\nsecond", 0)).toBe("first\nsecond");
    expect(removeInlineLink("one\nhttps://a.dev two", 0)).toBe("one\ntwo");
    expect(removeInlineLink("no links", 0)).toBe("no links");
  });
});

describe("replaceInlineLink", () => {
  it("changes only the chosen URL", () => {
    const text = "a https://a.dev b https://a.dev.";
    expect(replaceInlineLink(text, 1, "https://c.dev")).toBe("a https://a.dev b https://c.dev.");
    expect(replaceInlineLink(text, 5, "https://c.dev")).toBe(text);
  });
});
