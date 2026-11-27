import { z } from "zod";
import { isoDateSchema, slackSubmissionKindSchema } from "@/contracts";
import { MAX_PROJECT_ROWS } from "./ids";

/**
 * Modal `private_metadata`. Set by us, echoed back by Slack inside a signed payload.
 * `userId` is still re-checked against the submitting Slack user before any write.
 */
export const modalMetadataSchema = z.object({
  kind: slackSubmissionKindSchema,
  logDate: isoDateSchema, // default work date (time modal) or first PTO date
  userId: z.uuid(),
  today: isoDateSchema, // user-local date when the modal opened → check-in date
  // A16: every rendered row is required; 0 = no project rows rendered (user has no projects).
  rows: z.number().int().min(0).max(MAX_PROJECT_ROWS).default(1),
  /** A16: project preselected in row 1 (opened from the project channel prompt). */
  projectId: z.string().min(1).optional(),
});
export type ModalMetadata = z.infer<typeof modalMetadataSchema>;

export function encodeMetadata(meta: ModalMetadata): string {
  return JSON.stringify(meta);
}

/** Returns null for missing or tampered metadata. */
export function decodeMetadata(raw: string | undefined | null): ModalMetadata | null {
  if (!raw) return null;
  try {
    const parsed = modalMetadataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
