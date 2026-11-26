import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import uk from "../../messages/uk.json";

/** A14: every web string exists in both languages with the same ICU arguments and rich-text tags. */
type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** ICU argument names (`{name}`, `{count, plural, …}`) and rich tags (`<n>`). */
function tokens(message: string): string[] {
  const args = [...message.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => `{${m[1]}}`);
  const tags = [...message.matchAll(/<(\w+)>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...args, ...tags])].sort();
}

const enFlat = flatten(en as Tree);
const ukFlat = flatten(uk as Tree);

describe("messages en/uk parity", () => {
  it("has the same keys in both languages", () => {
    expect([...ukFlat.keys()].sort()).toEqual([...enFlat.keys()].sort());
  });

  it("has no empty messages", () => {
    for (const [key, value] of [...enFlat, ...ukFlat]) expect(value.trim(), key).not.toBe("");
  });

  it("uses the same ICU arguments and tags", () => {
    for (const [key, value] of enFlat) {
      expect(tokens(ukFlat.get(key) ?? ""), key).toEqual(tokens(value));
    }
  });

  it("compiles and formats every message (valid ICU) in both languages", () => {
    for (const [locale, messages, flat] of [
      ["en", en, enFlat],
      ["uk", uk, ukFlat],
    ] as const) {
      const errors: string[] = [];
      const t = createTranslator({ locale, messages, onError: (e) => errors.push(e.message) });
      for (const [key, value] of flat) {
        const values: Record<string, string | number | ((chunks: string) => string)> = {};
        for (const token of tokens(value)) {
          if (token.startsWith("<")) values[token.slice(1, -1)] = (chunks) => chunks;
          else values[token.slice(1, -1)] = token === "{unit}" ? "week" : 2;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- keys are dynamic here
        const out = t.markup(key as any, values as any);
        expect(out, `${locale}:${key}`).not.toContain("{");
      }
      expect(errors, locale).toEqual([]);
    }
  });

  it("translates the main navigation and sign-in copy", () => {
    expect(uk.nav).toMatchObject({ myTime: "Мій час", team: "Команда", admin: "Адміністрування" });
    expect(uk.login.signIn).toBe("Увійти через Slack");
  });
});
