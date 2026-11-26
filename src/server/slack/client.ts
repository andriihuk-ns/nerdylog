import "server-only";
import { WebClient } from "@slack/web-api";
import { serverEnv } from "@/lib/env";

let client: WebClient | undefined;

/**
 * Lazily created bot-token client. Retries are kept short: on Vercel a request must ack
 * Slack within 3 s, and the default policy retries for ~30 minutes. Rate-limited calls reject.
 */
export function getSlackClient(): WebClient {
  client ??= new WebClient(serverEnv().SLACK_BOT_TOKEN, {
    retryConfig: { retries: 1, minTimeout: 200, maxTimeout: 800 },
    timeout: 5000,
    // Fail fast on HTTP 429 instead of sleeping for Retry-After (30s+): a serverless
    // request must never hang on Slack's rate limits; callers degrade gracefully.
    rejectRateLimitedCalls: true,
  });
  return client;
}
