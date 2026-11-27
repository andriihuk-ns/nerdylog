import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { serializeChecklist } from "@/contracts";
import en from "../../../messages/en.json";
import { TaskGroupList } from "./task-group-list";

function render(summary: string): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <TaskGroupList summaries={[summary]} />
    </NextIntlClientProvider>,
  );
}

describe("TaskGroupList link placement (A28)", () => {
  it("renders inline links where they were and field links after the text", () => {
    const html = render(
      serializeChecklist([
        { text: "Overhaul (https://react.dev) done.", link: "https://github.com/a/b", done: false },
      ]),
    );
    const order = ["Overhaul (", 'href="https://react.dev/"', ") done.", 'href="https://github.com/a/b"'].map((part) =>
      html.indexOf(part),
    );
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("still renders older tasks whose links were stored separately", () => {
    const html = render(serializeChecklist([{ text: "Overhaul () done", link: "https://react.dev", done: false }]));
    expect(html.indexOf("Overhaul () done")).toBeLessThan(html.indexOf('href="https://react.dev/"'));
  });
});
