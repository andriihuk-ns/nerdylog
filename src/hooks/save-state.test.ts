import { describe, expect, it } from "vitest";
import { fieldSave, saveReducer, type SaveState } from "./save-state";

describe("saveReducer", () => {
  it("goes saving → saved → faded", () => {
    let s: SaveState = {};
    s = saveReducer(s, { type: "start", field: "role" });
    expect(fieldSave(s, "role")).toMatchObject({ status: "saving", visible: true, seq: 1 });
    s = saveReducer(s, { type: "success", field: "role", seq: 1 });
    expect(fieldSave(s, "role").status).toBe("saved");
    s = saveReducer(s, { type: "fade", field: "role", seq: 1 });
    expect(fieldSave(s, "role")).toMatchObject({ status: "idle", visible: false });
  });

  it("keeps errors until the next edit and ignores fades for them", () => {
    let s = saveReducer({}, { type: "start", field: "norm" });
    s = saveReducer(s, { type: "fail", field: "norm", seq: 1, message: "Nope" });
    expect(saveReducer(s, { type: "fade", field: "norm", seq: 1 })).toBe(s);
    expect(fieldSave(s, "norm")).toMatchObject({ status: "error", message: "Nope" });
    s = saveReducer(s, { type: "start", field: "norm" });
    expect(fieldSave(s, "norm")).toMatchObject({ status: "saving", message: null, seq: 2 });
  });

  it("ignores a stale fade from an older save", () => {
    let s = saveReducer({}, { type: "start", field: "role" });
    s = saveReducer(s, { type: "success", field: "role", seq: 1 });
    s = saveReducer(s, { type: "start", field: "role" });
    s = saveReducer(s, { type: "success", field: "role", seq: 2 });
    expect(fieldSave(saveReducer(s, { type: "fade", field: "role", seq: 1 }), "role").status).toBe("saved");
  });

  it("ignores a slow result from a superseded save", () => {
    let s = saveReducer({}, { type: "start", field: "role" });
    s = saveReducer(s, { type: "start", field: "role" });
    expect(saveReducer(s, { type: "fail", field: "role", seq: 1, message: "old" })).toBe(s);
  });

  it("keeps fields independent", () => {
    const s = saveReducer({}, { type: "start", field: "role" });
    expect(fieldSave(s, "office").status).toBe("idle");
  });
});
