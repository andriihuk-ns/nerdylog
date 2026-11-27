import { z } from "zod";
import { viewStateValuesSchema } from "./parse/state";

/** Only the interaction payload fields Tempo reads; everything else passes through. */
const userSchema = z.object({ id: z.string().min(1) }).loose();

const viewSchema = z
  .object({
    id: z.string().min(1),
    hash: z.string().optional(),
    callback_id: z.string().optional(),
    private_metadata: z.string().optional(),
    state: z.object({ values: viewStateValuesSchema }).loose().optional(),
  })
  .loose();

const blockActionsSchema = z
  .object({
    type: z.literal("block_actions"),
    trigger_id: z.string().optional(),
    user: userSchema,
    actions: z.array(z.object({ action_id: z.string(), value: z.string().optional() }).loose()).min(1),
    view: viewSchema.optional(),
    channel: z.object({ id: z.string().min(1) }).loose().optional(), // message buttons only
    container: z.object({ channel_id: z.string().optional() }).loose().optional(),
  })
  .loose();

const viewSubmissionSchema = z
  .object({ type: z.literal("view_submission"), user: userSchema, view: viewSchema })
  .loose();

const otherSchema = z.object({ type: z.string() }).loose();

export type BlockActionsPayload = z.infer<typeof blockActionsSchema>;
export type ViewSubmissionPayload = z.infer<typeof viewSubmissionSchema>;
export type InteractionPayload = BlockActionsPayload | ViewSubmissionPayload | z.infer<typeof otherSchema>;

/** Parses the `payload` field of an interactivity request. Null when unparseable. */
export function parseInteractionPayload(form: URLSearchParams): InteractionPayload | null {
  const raw = form.get("payload");
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  for (const schema of [blockActionsSchema, viewSubmissionSchema]) {
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
  }
  const other = otherSchema.safeParse(json);
  return other.success ? other.data : null;
}

export function isBlockActions(p: InteractionPayload): p is BlockActionsPayload {
  return p.type === "block_actions" && "actions" in p;
}

export function isViewSubmission(p: InteractionPayload): p is ViewSubmissionPayload {
  return p.type === "view_submission" && "view" in p;
}
