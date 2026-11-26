import { BLOCK, CALLBACK, INPUT_ACTION, MAX_PTO_BUSINESS_DAYS } from "../ids";
import { encodeMetadata, type ModalMetadata } from "../metadata";
import type { ModalView } from "../types";
import { context, modalTitle, plain } from "./common";

export const PTO_TYPES = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick day" },
] as const;

/** Quick PTO modal (FR-SLACK-01 secondary CTA and /pto). `meta.logDate` is the first day. */
export function buildPtoModal(meta: ModalMetadata): ModalView {
  const options = PTO_TYPES.map((t) => ({ text: plain(t.label), value: t.value }));
  return {
    type: "modal",
    callback_id: CALLBACK.pto,
    private_metadata: encodeMetadata({ ...meta, kind: "pto" }),
    title: modalTitle("Quick PTO"),
    submit: plain("Save"),
    close: plain("Cancel"),
    blocks: [
      {
        type: "input",
        block_id: BLOCK.ptoType,
        label: plain("Type"),
        element: { type: "radio_buttons", action_id: INPUT_ACTION, options, initial_option: options[0] },
      },
      {
        type: "input",
        block_id: BLOCK.ptoStart,
        label: plain("Date"),
        element: { type: "datepicker", action_id: INPUT_ACTION, initial_date: meta.logDate },
      },
      {
        type: "input",
        block_id: BLOCK.ptoEnd,
        optional: true,
        label: plain("Until (optional)"),
        hint: plain("Leave empty for a single day."),
        element: { type: "datepicker", action_id: INPUT_ACTION },
      },
      context(
        `Up to ${MAX_PTO_BUSINESS_DAYS} business days at a time. Weekends and company holidays are skipped.`,
      ),
    ],
  };
}
