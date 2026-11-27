import { z } from "zod";
import { isoDateSchema, type IsoDate, type Locale } from "@/contracts";
import { longDate } from "../dates";
import { t } from "../i18n";
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
  locale: Locale;
}

/** Slack caps header text at 150 characters. */
const HEADER_MAX = 150;

/** A16/A31/A32: a project's daily status prompt, sent privately to one member in their locale. */
export function buildProjectPrompt({ projectId, projectName, logDate, locale }: ProjectPromptInput): SlackMessage {
  const title = t(locale, "prompt.title", { project: projectName }).slice(0, HEADER_MAX);
  const body = t(locale, "prompt.body", { date: longDate(logDate, locale) });
  return {
    text: `${title}: ${body.replace(/\*/g, "")}`,
    blocks: [
      header(title),
      mrkdwnSection(body),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: ACTION.projectStatusOpen,
            text: plain(t(locale, "prompt.button")),
            style: "primary",
            value: encodePromptValue({ projectId, logDate }),
          },
        ],
      },
    ],
  };
}
