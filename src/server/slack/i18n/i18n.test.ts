import { describe, expect, it } from "vitest";
import { buildAppHome } from "../blocks/app-home";
import { buildPtoModal } from "../blocks/pto-modal";
import { buildTimeModal } from "../blocks/time-modal";
import { formatHours, longDate, monthName, weekdayName } from "../dates";
import { BLOCK, INPUT_ACTION, rowBlock } from "../ids";
import type { ModalMetadata } from "../metadata";
import { parseHours, parseTimeSubmission } from "../parse/time-submission";
import { fakeDeps, profile, project, PROJECT_ID, ptoBalance, USER_ID } from "../testing/fake-deps";
import { handleSlashCommand } from "../handlers/commands";
import { publishHome } from "../handlers/home";
import { en } from "./en";
import { localeOf, t, tPlural } from "./index";
import { uk } from "./uk";

const meta = (over: Partial<ModalMetadata> = {}): ModalMetadata => ({
  kind: "standup",
  logDate: "2026-11-25", // Wednesday
  userId: USER_ID,
  today: "2026-11-26",
  rows: 1,
  ...over,
});
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dictionaries", () => {
  it("uk has exactly the en keys (no missing, no extra)", () => {
    expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort());
  });

  it("every uk string is non-empty and uses the same placeholders as en", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(uk[key].trim(), key).not.toBe("");
      expect(placeholders(uk[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("modal titles fit Slack's 24-character limit in both locales", () => {
    for (const key of ["title.standup", "title.log", "title.pto"] as const) {
      expect(en[key].length, key).toBeLessThanOrEqual(24);
      expect(uk[key].length, key).toBeLessThanOrEqual(24);
    }
  });

  it("t fills placeholders; tPlural follows Ukrainian plural rules", () => {
    expect(t("uk", "time.projectLabel", { n: 2 })).toBe("Проєкт 2");
    expect(t("en", "cmd.unknown", { command: "/x" })).toBe("Unknown command /x. Try /log or /pto.");
    expect([1, 3, 5, 21, 12].map((n) => tPlural("uk", "plural.days", n))).toEqual([
      "1 день",
      "3 дні",
      "5 днів",
      "21 день",
      "12 днів",
    ]);
    expect(tPlural("uk", "plural.days", 2.5, "2,5")).toBe("2,5 дня");
    expect(tPlural("en", "plural.days", 1)).toBe("1 day");
  });

  it("missing or unknown locales fall back to Ukrainian", () => {
    expect(localeOf(null)).toBe("uk");
    expect(localeOf({})).toBe("uk");
    expect(localeOf({ locale: "de" })).toBe("uk");
    expect(localeOf({ locale: "en" })).toBe("en");
  });
});

describe("locale formatting", () => {
  it("uses Intl weekday/month names and the locale decimal separator", () => {
    expect(weekdayName("2026-11-25", "uk")).toBe("середа");
    expect(longDate("2026-11-25", "uk")).toBe("середа, 25 листопада");
    expect(monthName("2026-11", "uk")).toBe("листопад");
    expect(formatHours(2.5, "uk")).toBe("2,5 год");
    expect(formatHours(2.5)).toBe("2.5h"); // shared posts stay English
  });
});

describe("hours parsing (A14)", () => {
  it("accepts both 2.5 and 2,5", () => {
    expect(parseHours("2.5", "uk")).toBe(2.5);
    expect(parseHours("2,5", "uk")).toBe(2.5);
    expect(parseHours(" 0,75 ", "en")).toBe(0.75);
    expect(parseHours("8", "en")).toBe(8);
  });

  it("rejects garbage with a localized message", () => {
    expect(parseHours("2,5,1", "uk")).toBe("Години мають бути від 0,25 до 24");
    expect(parseHours("abc", "en")).toBe("Numbers only, e.g. 0.5 or 0,5");
    expect(parseHours("1,3", "uk")).toContain("2,5");
  });

  it("a uk submission with a comma saves 2.5 hours; errors come back in Ukrainian", () => {
    const values = (hours: string) => ({
      [BLOCK.workDate]: { [INPUT_ACTION]: { selected_date: "2026-11-25" } },
      [rowBlock.project(1)]: { [INPUT_ACTION]: { selected_option: { value: PROJECT_ID } } },
      [rowBlock.hours(1)]: { [INPUT_ACTION]: { value: hours } },
      [rowBlock.task(1)]: { [INPUT_ACTION]: { value: "Map modal" } },
    });
    const bad = parseTimeSubmission({ viewId: "V", meta: meta(), values: values("2,5"), locale: "uk" });
    expect(bad.ok && bad.value.entries[0].hours).toBe(2.5);
    const log = parseTimeSubmission({ viewId: "V", meta: meta({ kind: "log" }), values: values("2,5"), locale: "uk" });
    expect(log.ok && log.value.entries[0].hours).toBe(2.5);
  });
});

describe("Ukrainian surfaces", () => {
  it("standup modal renders fully in Ukrainian", () => {
    const view = buildTimeModal({ meta: meta(), projects: [project], locale: "uk" });
    const text = JSON.stringify(view);
    expect(view.title.text).toBe("Щоденний статус");
    expect(view.submit?.text).toBe("Надіслати");
    expect(view.close?.text).toBe("Скасувати");
    for (const s of ["Робота · середа, 25 листопада", "Проєкт 1", "Час", "напр. 4 або 2,5", "Опис задачі", "+ Додати проєкт"]) {
      expect(text).toContain(s);
    }
    expect(text).not.toMatch(/Hours|Project|Pick a|Submit|Cancel/);
  });

  it("PTO modal renders in Ukrainian", () => {
    const view = buildPtoModal(meta({ kind: "pto" }), "uk");
    const text = JSON.stringify(view);
    expect(view.title.text).toBe("Відпустка / лікарняний");
    expect(text).toContain("Відпустка");
    expect(text).toContain("Лікарняний");
    expect(text).toContain("До 10 робочих днів за раз");
    expect(text).toContain("Останній день");
    expect(text).not.toContain("необовʼязково");
  });

  it("App Home renders in Ukrainian with uk dates and numbers", () => {
    const home = buildAppHome({
      appBaseUrl: "https://tempo.example",
      locale: "uk",
      weekHours: 32.5,
      today: null,
      projectHours: [{ projectId: "p", projectName: "DogTeamPro", month: "2026-11", hours: 32 }],
      pto: ptoBalance,
      nextHoliday: { holidayDate: "2026-12-25", name: "Різдво" },
      updatedLabel: "09:41",
    });
    const text = JSON.stringify(home.blocks);
    for (const s of ["Твій тиждень", "32,5 год", "Ще не записано", "Цього місяця за проєктами", "*DogTeamPro*  32,0 год", "Записати час", "Відпустка / лікарняний", "Залишок відпустки (2026)*\\n12 днів з 20", "2 дні", "25 груд.", "Відкрити веб-панель", "Оновлено о 09:41"]) {
      expect(text).toContain(s);
    }
  });
});

describe("A15 copy", () => {
  it("project-access and App Home strings exist in both locales; cap copy is gone", () => {
    for (const key of ["err.notMember", "err.anAdmin", "err.projectChannel", "home.byProject", "home.timeOffButton", "time.noProjects"] as const) {
      expect(en[key], key).toBeTruthy();
      expect(uk[key], key).toBeTruthy();
    }
    expect(Object.keys(en).some((k) => k.includes("Cap") || k.includes("cap"))).toBe(false);
    expect(t("uk", "time.noProjects")).toBe("Тебе ще немає в жодному каналі проєкту. Попроси адміна додати тебе.");
  });

  it("App Home handler renders the user's month hours per project in their locale", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.resolveUser.mockResolvedValue({ ...profile, locale: "uk" });
    tempo.getProjectHours.mockResolvedValueOnce([{ projectId: "p", projectName: "DogTeamPro", month: "2026-11", hours: 12.5 }]);
    await publishHome(deps, "U123");
    expect(tempo.getProjectHours).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }), "2026-11");
    expect(tempo.listHolidayDates).toHaveBeenCalledWith(USER_ID, "2026-11-26", "2027-12-31");
    const text = JSON.stringify((slack.publishHome.mock.calls[0] as unknown[])[1]);
    expect(text).toContain("*DogTeamPro*  12,5 год");
    expect(text).toContain("25 груд. · Christmas");
  });

  it("App Home shows no holiday when the user's office has none", async () => {
    const { deps, slack, tempo } = fakeDeps();
    tempo.listHolidayDates.mockResolvedValue([]);
    await publishHome(deps, "U123");
    expect(JSON.stringify((slack.publishHome.mock.calls[0] as unknown[])[1])).toContain("None planned");
  });
});

describe("handlers pick the recipient's locale", () => {
  it("unknown Slack users get Ukrainian notices and App Home", async () => {
    const { deps, slack, flush } = fakeDeps();
    await handleSlashCommand(new URLSearchParams({ command: "/pto", trigger_id: "T", user_id: "U_STRANGER" }), deps);
    await flush();
    const notice = (slack.updateView.mock.calls[0] as unknown[])[1];
    expect(JSON.stringify(notice)).toContain("Тебе ще немає в nerdylog");

    await publishHome(deps, "U_STRANGER");
    expect(JSON.stringify((slack.publishHome.mock.calls[0] as unknown[])[1])).toContain("Тебе ще немає в nerdylog");
  });

  it("unknown command from an unknown user is answered in Ukrainian", async () => {
    const { deps } = fakeDeps();
    const res = await handleSlashCommand(new URLSearchParams({ command: "/nope", trigger_id: "T", user_id: "U_X" }), deps);
    expect((await res.json()).text).toBe("Не знаю команди /nope. Спробуй /log або /pto.");
  });

  it("a uk user gets a Ukrainian log modal", async () => {
    const { deps, slack, tempo, flush } = fakeDeps();
    tempo.resolveUser.mockResolvedValue({ ...profile, locale: "uk" });
    await handleSlashCommand(new URLSearchParams({ command: "/log", trigger_id: "T", user_id: "U123" }), deps);
    await flush();
    const view = (slack.updateView.mock.calls[0] as unknown[])[1] as { title: { text: string } };
    expect(view.title.text).toBe("Записати час");
  });

});
