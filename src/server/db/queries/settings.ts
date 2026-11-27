import { eq } from "drizzle-orm";
import { appSettings } from "../schema";
import type { DbOrTx } from "./types";

/** A11 keys stored in `app_settings`. */
export const SETTING_KEYS = { standupChannelId: "standup_channel_id", officeOrder: "office_order" } as const;
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Value for `key`, or null when the row is absent. */
export async function getSetting(db: DbOrTx, key: SettingKey): Promise<string | null> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? null;
}

/** Insert or overwrite `key`. */
export async function upsertSetting(db: DbOrTx, key: SettingKey, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

/** Remove `key` (no-op when absent). */
export async function deleteSetting(db: DbOrTx, key: SettingKey): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}
