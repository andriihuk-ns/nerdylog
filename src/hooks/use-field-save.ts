"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { fieldSave, SAVED_FADE_MS, saveReducer, type FieldSave } from "./save-state";

/**
 * Per-field save status for inline editors. `track(field, run)` marks the field saving, awaits
 * `run` (null on success, else an error message) and schedules the "Saved ✓" fade.
 */
export function useFieldSave(): {
  get: (field: string) => FieldSave;
  track: (field: string, run: () => Promise<string | null>) => Promise<void>;
} {
  const [state, dispatch] = useReducer(saveReducer, {});
  const timers = useRef(new Set<number>());
  // Counts "start"s per field in lockstep with the reducer's `seq` (both begin at 0).
  const starts = useRef(new Map<string, number>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const track = useCallback(async (field: string, run: () => Promise<string | null>) => {
    const seq = (starts.current.get(field) ?? 0) + 1;
    starts.current.set(field, seq);
    dispatch({ type: "start", field });
    const error = await run();
    if (error) {
      dispatch({ type: "fail", field, seq, message: error });
      return;
    }
    dispatch({ type: "success", field, seq });
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      dispatch({ type: "fade", field, seq });
    }, SAVED_FADE_MS);
    timers.current.add(t);
  }, []);

  const get = useCallback((field: string) => fieldSave(state, field), [state]);
  return { get, track };
}
