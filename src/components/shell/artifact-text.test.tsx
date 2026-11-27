import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtifactText, chipLabel } from "./artifact-text";

describe("ArtifactText (A17)", () => {
  it("renders links as safe new-tab chips with provider labels and keeps the text", () => {
    const html = renderToStaticMarkup(
      <ArtifactText text="Fixed https://acme.atlassian.net/browse/DOG-1364 and https://www.figma.com/design/abc/map-modal-v2" />,
    );
    expect(html).toContain("Fixed ");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Jira · DOG-1364");
    expect(html).toContain("Figma · Map modal v2");
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  it("renders plain text without chips", () => {
    expect(renderToStaticMarkup(<ArtifactText text="No links here" />)).not.toContain("<a ");
  });

  it("labels generic links by host only", () => {
    expect(chipLabel({ url: "https://example.com/x", provider: "web", label: "example.com" })).toBe("example.com");
  });
});
