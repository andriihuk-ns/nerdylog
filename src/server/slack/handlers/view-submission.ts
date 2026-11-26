import type { IsoDate } from "@/contracts";
import { noticeModal, notLinkedMessage } from "../blocks/common";
import { yearOf } from "../dates";
import { CALLBACK } from "../ids";
import { decodeMetadata } from "../metadata";
import { parsePtoSubmission, ptoRange } from "../parse/pto-submission";
import type { FieldErrors } from "../parse/state";
import { parseTimeSubmission } from "../parse/time-submission";
import type { ViewSubmissionPayload } from "../payloads";
import type { SlackDeps } from "../types";
import { holidaySet } from "./modal-loader";
import { processSubmission } from "./submit";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function errorsResponse(errors: FieldErrors): Response {
  return Response.json({ response_action: "errors", errors });
}

function noticeResponse(message: string): Response {
  return Response.json({ response_action: "update", view: noticeModal("Tempo", message) });
}

/**
 * Synchronous half of a view_submission: verify identity, validate, and either return
 * `response_action: "errors"` or ack with an empty 200 (closes the modal). The write and
 * channel broadcast run after the response via `deps.defer`.
 */
export async function handleViewSubmission(payload: ViewSubmissionPayload, deps: SlackDeps): Promise<Response> {
  const { view } = payload;
  const callback = view.callback_id;
  if (callback !== CALLBACK.time && callback !== CALLBACK.pto) return new Response(null, { status: 200 });

  const meta = decodeMetadata(view.private_metadata);
  if (!meta) return noticeResponse("This form has expired. Please open it again.");

  const profile = await deps.tempo.resolveUser(payload.user.id);
  if (!profile) return noticeResponse(notLinkedMessage(deps.appBaseUrl));
  if (profile.userId !== meta.userId) return noticeResponse("This form belongs to someone else.");

  const values = view.state?.values ?? {};
  let result;
  if (callback === CALLBACK.pto) {
    const { start, end } = ptoRange(values);
    const years = [start, end].filter((d): d is IsoDate => !!d && ISO.test(d)).map(yearOf);
    const holidays = years.length > 0 ? await holidaySet(deps.tempo, profile, years) : new Set<IsoDate>();
    result = parsePtoSubmission({ viewId: view.id, meta: { ...meta, kind: "pto" }, values, holidays });
  } else {
    if (meta.kind === "pto") return noticeResponse("This form has expired. Please open it again.");
    result = parseTimeSubmission({ viewId: view.id, meta, values });
  }

  if (!result.ok) return errorsResponse(result.errors);
  const input = result.value;
  deps.defer(() => processSubmission(deps, profile, input));
  return new Response(null, { status: 200 });
}
