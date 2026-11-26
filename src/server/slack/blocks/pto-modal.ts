import type { Locale } from "@/contracts";
import { t } from "../i18n";
import { BLOCK, CALLBACK, INPUT_ACTION, MAX_PTO_BUSINESS_DAYS } from "../ids";
import { encodeMetadata, type ModalMetadata } from "../metadata";
import type { ModalView } from "../types";
import { context, modalTitle, plain } from "./common";

export const PTO_TYPES = [
  { value: "vacation", labelKey: "pto.vacation" },
  { value: "sick", labelKey: "pto.sick" },
] as const;

/** Quick PTO modal (FR-SLACK-01 secondary CTA and /pto). `meta.logDate` is the first day. */
export function buildPtoModal(meta: ModalMetadata, locale: Locale): ModalView {
  const options = PTO_TYPES.map((p) => ({ text: plain(t(locale, p.labelKey)), value: p.value }));
  return {
    type: "modal",
    callback_id: CALLBACK.pto,
    private_metadata: encodeMetadata({ ...meta, kind: "pto" }),
    title: modalTitle(t(locale, "title.pto")),
    submit: plain(t(locale, "common.save")),
    close: plain(t(locale, "common.cancel")),
    blocks: [
      {
        type: "input",
        block_id: BLOCK.ptoType,
        label: plain(t(locale, "pto.type")),
        element: { type: "radio_buttons", action_id: INPUT_ACTION, options, initial_option: options[0] },
      },
      {
        type: "input",
        block_id: BLOCK.ptoStart,
        label: plain(t(locale, "pto.date")),
        element: { type: "datepicker", action_id: INPUT_ACTION, initial_date: meta.logDate },
      },
      {
        type: "input",
        block_id: BLOCK.ptoEnd,
        optional: true,
        label: plain(t(locale, "pto.until")),
        hint: plain(t(locale, "pto.untilHint")),
        element: { type: "datepicker", action_id: INPUT_ACTION },
      },
      context(t(locale, "pto.rules", { max: MAX_PTO_BUSINESS_DAYS })),
    ],
  };
}
