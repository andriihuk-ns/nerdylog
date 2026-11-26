import { z } from "zod";
import { INPUT_ACTION } from "../ids";

/** One element's state in `view.state.values[blockId][actionId]`. */
const elementStateSchema = z
  .object({
    type: z.string().optional(),
    value: z.string().nullish(),
    selected_date: z.string().nullish(),
    selected_option: z.object({ value: z.string() }).nullish(),
  })
  .loose();

export const viewStateValuesSchema = z.record(z.string(), z.record(z.string(), elementStateSchema));
export type ViewStateValues = z.infer<typeof viewStateValuesSchema>;

/** Block-id → message map returned as `response_action: "errors"`. */
export type FieldErrors = Record<string, string>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

function element(values: ViewStateValues, blockId: string) {
  return values[blockId]?.[INPUT_ACTION];
}

/** Trimmed text value, "" when empty or missing. */
export function textValue(values: ViewStateValues, blockId: string): string {
  return (element(values, blockId)?.value ?? "").trim();
}

export function dateValue(values: ViewStateValues, blockId: string): string | null {
  return element(values, blockId)?.selected_date ?? null;
}

export function optionValue(values: ViewStateValues, blockId: string): string | null {
  return element(values, blockId)?.selected_option?.value ?? null;
}
