/**
 * A15 per-field save indicator: "Saving…" → "Saved ✓" (fades after 2s) → inline error.
 * Pure reducer keyed by field name; `seq` makes late results and fades from an older save no-ops.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface FieldSave {
  status: SaveStatus;
  /** False once a "saved" badge has faded; the text stays so the fade can animate. */
  visible: boolean;
  message: string | null;
  seq: number;
}

export type SaveState = Record<string, FieldSave>;

export type SaveAction =
  | { type: "start"; field: string }
  | { type: "success"; field: string; seq: number }
  | { type: "fail"; field: string; seq: number; message: string }
  | { type: "fade"; field: string; seq: number };

export const SAVED_FADE_MS = 2000;

const IDLE: FieldSave = { status: "idle", visible: false, message: null, seq: 0 };

export function fieldSave(state: SaveState, field: string): FieldSave {
  return state[field] ?? IDLE;
}

export function saveReducer(state: SaveState, action: SaveAction): SaveState {
  const cur = fieldSave(state, action.field);
  switch (action.type) {
    case "start":
      return { ...state, [action.field]: { status: "saving", visible: true, message: null, seq: cur.seq + 1 } };
    case "success":
      if (cur.seq !== action.seq) return state;
      return { ...state, [action.field]: { ...cur, status: "saved", visible: true, message: null } };
    case "fail":
      if (cur.seq !== action.seq) return state;
      return { ...state, [action.field]: { ...cur, status: "error", visible: true, message: action.message } };
    case "fade":
      if (cur.status !== "saved" || cur.seq !== action.seq) return state;
      return { ...state, [action.field]: { ...cur, status: "idle", visible: false } };
  }
}
