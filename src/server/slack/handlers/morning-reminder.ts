import { buildMorningReminder } from "../blocks/morning-reminder";
import type { SlackDeps } from "../types";

export interface MorningReminderResult {
  claimed: number;
  posted: number;
  failed: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A19 personal DM reminder; each failed delivery is reported without stopping other users. */
export async function runMorningReminders(
  deps: Pick<SlackDeps, "slack" | "tempo" | "now">,
): Promise<MorningReminderResult> {
  const targets = await deps.tempo.claimMorningReminders(deps.now());
  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const channel = await deps.slack.openDm(target.slackUserId);
      const message = buildMorningReminder(target);
      await deps.slack.postMessage(channel, message.text, message.blocks);
    }),
  );
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failed += 1;
      console.error("cron/morning-ping: reminder failed", targets[index].userId, errorMessage(result.reason));
    }
  });
  return { claimed: targets.length, posted: targets.length - failed, failed };
}
