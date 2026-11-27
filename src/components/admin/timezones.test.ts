import { describe, expect, it } from "vitest";
import { OFFICE_TIMEZONES, timezoneOptions } from "./timezones";

describe("timezoneOptions", () => {
  it("lists the subset", () => {
    expect(timezoneOptions()).toEqual([...OFFICE_TIMEZONES]);
    expect(timezoneOptions("Europe/Kyiv")).toEqual([...OFFICE_TIMEZONES]);
  });
  it("keeps an unlisted current value first", () => {
    expect(timezoneOptions("Asia/Tokyo")[0]).toBe("Asia/Tokyo");
  });
});
