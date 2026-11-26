import { DEFAULT_LOCALE, type Locale, type PingTarget } from "@/contracts";
import { buildMorningDm } from "../blocks/morning-dm";
import { localeOf } from "../i18n";
import type { SlackDeps } from "../types";

export interface MorningPingResult {
  claimed: number;
  sent: number;
  failed: number;
}

/**
 * A14: the DM uses the recipient's locale. PingTarget has no `locale` yet (contract request),
 * so it is read from the Slack actor profile; a missing user or lookup error falls back to uk.
 */
async function targetLocale(deps: Pick<SlackDeps, "tempo">, target: PingTarget): Promise<Locale> {
  if ("locale" in target) return localeOf(target);
  try {
    return localeOf(await deps.tempo.resolveUser(target.slackUserId));
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * FR-SLACK-01 / amendment A4. `claimMorningPings` returns only users newly claimed for today
 * (daily_pings dedup), so a re-run inside the same window sends nothing twice. One failed DM
 * never stops the others. Note: a claimed user whose DM failed is not retried today.
 */
export async function runMorningPings(deps: Pick<SlackDeps, "slack" | "tempo" | "now">): Promise<MorningPingResult> {
  const targets = await deps.tempo.claimMorningPings(deps.now());
  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const [channel, locale] = await Promise.all([deps.slack.openDm(target.slackUserId), targetLocale(deps, target)]);
      const message = buildMorningDm({ fullName: target.fullName, logDate: target.logDate, locale });
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
