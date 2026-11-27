import { buildMorningDm } from "../blocks/morning-dm";
import { localeOf } from "../i18n";
import type { SlackDeps } from "../types";

export interface MorningPingResult {
  claimed: number;
  sent: number;
  failed: number;
}

/**
 * FR-SLACK-01 / amendment A4. `claimMorningPings` returns only users newly claimed for today
 * (daily_pings dedup), so a re-run inside the same window sends nothing twice. One failed DM
 * never stops the others; each DM uses the target's own `locale` (A14). Note: a claimed user
 * whose DM failed is not retried today.
 */
export async function runMorningPings(deps: Pick<SlackDeps, "slack" | "tempo" | "now">): Promise<MorningPingResult> {
  const targets = await deps.tempo.claimMorningPings(deps.now());
  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const channel = await deps.slack.openDm(target.slackUserId);
      const message = buildMorningDm({ fullName: target.fullName, logDate: target.logDate, locale: localeOf(target) });
      await deps.slack.postMessage(channel, message.text, message.blocks);
    }),
  );
  let failed = 0;
  results.forEach((r) => {
    if (r.status === "rejected") {
      failed += 1;
      console.error("cron/morning-ping: DM failed", r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });
  return { claimed: targets.length, sent: targets.length - failed, failed };
}
