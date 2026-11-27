import { z } from "zod";
import { isoDateSchema, type IsoDate } from "@/contracts";
import { ACTION } from "../ids";
import { header, mrkdwnSection, plain, type SlackMessage } from "./common";

/** Value of the "Log time & status" button: which project, and the default work date. */
export const promptButtonValueSchema = z.object({ projectId: z.string().min(1), logDate: isoDateSchema });
export type PromptButtonValue = z.infer<typeof promptButtonValueSchema>;

export function encodePromptValue(value: PromptButtonValue): string {
  return JSON.stringify(value);
}

/** Null for a missing or malformed button value. */
export function decodePromptValue(raw: string | undefined): PromptButtonValue | null {
  if (!raw) return null;
  try {
    const parsed = promptButtonValueSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface ProjectPromptInput {
  projectId: string;
  projectName: string;
  logDate: IsoDate;
}

/** Slack caps header text at 150 characters. */
const HEADER_MAX = 150;

/**
 * A16: the daily status prompt posted once per project in its channel. SHARED channel, so the
 * copy stays English (A14); the modal it opens is in the clicker's own locale.
 */
export function buildProjectPrompt({ projectId, projectName, logDate }: ProjectPromptInput): SlackMessage {
  const title = `Daily status · ${projectName}`.slice(0, HEADER_MAX);
  const line = "Log yesterday's hours.";
  return {
    text: `${title}: ${line}`,
    blocks: [
      header(title),
      mrkdwnSection(line),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: ACTION.projectStatusOpen,
            text: plain("Log time & status"),
            style: "primary",
            value: encodePromptValue({ projectId, logDate }),
          },
        ],
      },
    ],
  };
}
