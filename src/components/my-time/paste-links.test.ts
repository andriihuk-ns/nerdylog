import { describe, expect, it } from "vitest";
import { splitPastedLinks } from "./paste-links";

const A = "https://linear.app/acme/issue/DOG-1364";
const B = "https://figma.com/design/abc/Map";

describe("splitPastedLinks", () => {
  it("leaves text without links to the browser, ticket refs included", () => {
    expect(splitPastedLinks("DOG-1364 log attachments", [])).toBeNull();
  });

  it("moves links out of the text and into empty or new link fields", () => {
    expect(splitPastedLinks(`Map modal ${A}\n${B}`, [""])).toEqual({ text: "Map modal", links: [A, B] });
    expect(splitPastedLinks(A, [])).toEqual({ text: "", links: [A] });
  });

  it("does not duplicate a link the task already has", () => {
    expect(splitPastedLinks(`see ${A} today`, [A])).toEqual({ text: "see today", links: [A] });
  });

  it("moves any number of links and keeps only an over-long one in the text", () => {
    const many = Array.from({ length: 8 }, (_, i) => `https://example.com/${i}`);
    expect(splitPastedLinks(many.join(" "), [])?.links).toEqual(many);
    expect(splitPastedLinks(`https://example.com/${"x".repeat(2000)}`, [])).toBeNull();
  });
});
