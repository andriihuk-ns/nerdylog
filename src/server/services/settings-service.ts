import { z } from "zod";
import type { AppSettings, GetAppSettings, GetStandupChannelId, ListProjectChannels, UpdateAppSettings } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listProjectChannelRows } from "@/server/db/queries/catalog";
import { deleteSetting, getSetting, SETTING_KEYS, upsertSetting } from "@/server/db/queries/settings";
import type { DbOrTx } from "@/server/db/queries/types";
import { assertAdmin, assertManagerOrAdmin } from "./rbac";
import { parseInput, slackChannelIdSchema } from "./validation";

/**
 * Amendment A11: admin-chosen Slack channels.
 * - General standup channel lives in `app_settings` (key `standup_channel_id`); unset → nothing posted.
 * - Per-project channels live on `projects.slack_channel_id` (written via project-service upsertProject);
 *   `listProjectChannels` here is the system read for the Slack layer.
 */

/** Partial patch: an omitted key is left alone; null (or blank) clears it. */
const settingsPatchSchema = z.strictObject({
  standupChannelId: slackChannelIdSchema.optional(),
});

async function readSettings(db: DbOrTx): Promise<AppSettings> {
  return { standupChannelId: await getSetting(db, SETTING_KEYS.standupChannelId) };
}

/** Contract GetAppSettings (manager+ read). */
export const getAppSettings: GetAppSettings = async (actor) => {
  assertManagerOrAdmin(actor);
  return readSettings(getDb());
};

/** Contract UpdateAppSettings (admin). null deletes the row. Returns the settings after the write. */
export const updateAppSettings: UpdateAppSettings = async (actor, patch) => {
  assertAdmin(actor);
  const { standupChannelId } = parseInput(settingsPatchSchema, patch);
  const db = getDb();
  if (standupChannelId === null) await deleteSetting(db, SETTING_KEYS.standupChannelId);
  else if (standupChannelId !== undefined) await upsertSetting(db, SETTING_KEYS.standupChannelId, standupChannelId);
  return readSettings(db);
};

/** Contract GetStandupChannelId (system, no actor): null → do not post the general card. */
export const getStandupChannelId: GetStandupChannelId = async () => {
  return getSetting(getDb(), SETTING_KEYS.standupChannelId);
};

/** Contract ListProjectChannels (system, no actor): active projects with a non-null channel. */
export const listProjectChannels: ListProjectChannels = async () => {
  return listProjectChannelRows(getDb());
};
