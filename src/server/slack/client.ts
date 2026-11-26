import "server-only";
import { WebClient } from "@slack/web-api";
import { serverEnv } from "@/lib/env";

let client: WebClient | undefined;

/**
 * Lazily created bot-token client. Retries are kept short: on Vercel a request must ack
 * Slack within 3 s, and the default policy retries for ~30 minutes.
 */
export function getSlackClient(): WebClient {
  client ??= new WebClient(serverEnv().SLACK_BOT_TOKEN, {
    retryConfig: { retries: 1, minTimeout: 200, maxTimeout: 800 },
    timeout: 5000,
  });
  return client;
}
