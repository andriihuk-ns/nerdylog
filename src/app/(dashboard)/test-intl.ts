import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";

/**
 * Test double for `next-intl/server` in server-action unit tests (no request scope in Vitest):
 * `vi.mock("next-intl/server", () => import("../test-intl"))`. Always English.
 */
export async function getTranslations(namespace?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- namespace is dynamic in tests
  return createTranslator({ locale: "en", messages: en, namespace: namespace as any });
}

export async function getLocale() {
  return "en" as const;
}
