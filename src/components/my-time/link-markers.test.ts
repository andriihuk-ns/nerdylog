import { describe, expect, it } from "vitest";
import { applyEdit, fromMarked, markersIn, removeMarked, setMarkedUrl, toMarked } from "./link-markers";

const text = "UI (https://www.figma.com/) and React (https://react.dev/) again https://react.dev/ done";

describe("link markers", () => {
  it("replaces URLs with numbered markers and restores the stored text", () => {
    const marked = toMarked(text);
    expect(marked.display).toBe("UI ([🔗1 Figma · File]) and React ([🔗2 react.dev]) again [🔗3 react.dev] done");
    expect(marked.urls).toEqual(["https://www.figma.com/", "https://react.dev/", "https://react.dev/"]);
    expect(fromMarked(marked)).toBe(text);
  });

  it("removes a whole marker when an edit cuts into it", () => {
    const marked = toMarked("a https://react.dev/ b");
    const backspaced = marked.display.replace("]", "");
    expect(applyEdit(marked, backspaced)).toEqual({ display: "a  b", caret: 2 });
    expect(applyEdit(marked, `x${marked.display}`)).toEqual({ display: `x${marked.display}`, caret: null });
    expect(applyEdit(marked, "a [🔗1 react.dev]! b").caret).toBeNull();
  });

  it("edits a URL in place, including while it is incomplete", () => {
    const marked = toMarked(text);
    const partial = setMarkedUrl(marked, 1, "htt");
    expect(markersIn(partial).map((found) => found.url)).toHaveLength(3);
    const done = setMarkedUrl(partial, 1, "https://vite.dev/");
    expect(fromMarked(done)).toBe(text.replace("https://react.dev/", "https://vite.dev/"));
  });

  it("removes one link with its brackets and keeps the others", () => {
    expect(removeMarked(toMarked(text), 1)).toBe("UI (https://www.figma.com/) and React again https://react.dev/ done");
  });
});
