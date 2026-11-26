import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NerdylogLogo } from "./nerdylog-logo";

describe("NerdylogLogo", () => {
  it("is an accessible image that follows text color for 'nerdy' and keeps orange 'log'", () => {
    const html = renderToStaticMarkup(<NerdylogLogo height={20} className="x" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="nerdylog"');
    expect(html.match(/fill="currentColor"/g)).toHaveLength(5);
    expect(html.match(/fill="#FFA500"/g)).toHaveLength(3);
    expect(html).toContain('height="20"');
    expect(html).toContain('class="x"');
  });
});
