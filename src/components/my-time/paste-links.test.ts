import { describe, expect, it } from "vitest";
import { splitPastedLinks } from "./paste-links";

const A = "https://linear.app/acme/issue/DOG-1364";
const B = "https://figma.com/design/abc/Map";

describe("splitPastedLinks", () => {
  it("leaves text without links to the browser, ticket refs included", () => {
    expect(splitPastedLinks("DOG-1364 log attachments", [], 3)).toBeNull();
  });

  it("moves links out of the text and into empty or new link fields", () => {
    expect(splitPastedLinks(`Map modal ${A}\n${B}`, [""], 3)).toEqual({ text: "Map modal", links: [A, B] });
    expect(splitPastedLinks(A, [], 3)).toEqual({ text: "", links: [A] });
  });

  it("does not duplicate a link the task already has", () => {
    expect(splitPastedLinks(`see ${A} today`, [A], 3)).toEqual({ text: "see today", links: [A] });
  });

  it("keeps links that do not fit in the text", () => {
    expect(splitPastedLinks(`${A} ${B}`, [], 1)).toEqual({ text: ` ${B}`, links: [A] });
    expect(splitPastedLinks(B, [A], 1)).toBeNull();
  });
});
