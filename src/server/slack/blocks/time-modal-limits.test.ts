import { describe, expect, it } from "vitest";
import { MAX_TASK_ITEMS } from "../ids";
import { buildTimeModal } from "./time-modal";

/** Every value found under `key`, anywhere in the view. */
function collect(node: unknown, key: string): unknown[] {
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([k, v]) => (k === key ? [v] : collect(v, key)));
}

describe("time modal stays within Slack's limits", () => {
  const all = Array.from({ length: MAX_TASK_ITEMS }, (_, i) => i + 1);

  for (const locale of ["en", "uk"] as const) {
    for (const kind of ["standup", "log"] as const) {
      it(`${kind} (${locale})`, () => {
        const view = buildTimeModal({
          meta: { kind, logDate: "2026-11-26", userId: "00000000-0000-4000-8000-000000000001", today: "2026-11-27", rows: 1, tasks: [{ count: MAX_TASK_ITEMS, links: all }] },
          projects: [{ id: "p1", name: "DogTeamPro" } as never],
          locale,
        });
        for (const max of collect(view, "max_length")) expect(max).toBeLessThanOrEqual(3000);
        for (const label of collect(view, "placeholder")) expect((label as { text: string }).text.length).toBeLessThanOrEqual(150);
        expect(view.title.text.length).toBeLessThanOrEqual(24);
        expect(view.blocks.length).toBeLessThanOrEqual(100);
      });
    }
  }
});
