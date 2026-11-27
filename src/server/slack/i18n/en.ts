/**
 * A14: English bot copy for PERSONAL Slack surfaces (DMs, modals, App Home, ephemeral replies).
 * This dictionary is the source of truth for keys; `uk.ts` must provide every key.
 * Placeholders use `{name}` and are filled by `t()`. Shared channel posts do not use this.
 */
export const en = {
  // Common
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.submit": "Submit",
  "common.save": "Save",
  "common.openWeb": "Open Web Panel",
  "common.notLinked":
    "You are not set up in nerdylog yet. Sign in once at <{url}|nerdylog> or ask an admin to sync the team from Slack.",
  "common.formExpired": "This form has expired. Please open it again.",
  "common.formNotYours": "This form belongs to someone else.",
  "common.loadFailed": "Something went wrong loading nerdylog. Please try again.",
  "common.saveFailedDm": "nerdylog could not save your last submission. Please try again or use the web panel.",

  // Modal titles (Slack caps titles at 24 characters)
  "title.standup": "Daily status",
  "title.log": "Log time",
  "title.pto": "Quick PTO",

  // Slash command replies (ephemeral)
  "cmd.unknown": "Unknown command {command}. Try /log or /pto.",
  "cmd.noTrigger": "Slack did not send a trigger. Please try again.",
  "cmd.openFailed": "nerdylog could not open the form. Please try again.",
  "cmd.logHelp":
    "*Quick time logging:*\n• `/log` — open the time form\n• `/log 2.5 Task description` — pre-fill hours (supports `0.5` or `0,5`) and task\n• `/pto` — record vacation or sick day",

  // A16 project channel prompt (ephemeral replies to the clicker)
  "prompt.notMember": "Ask {creator} to add you to this project.",
  "prompt.inactive": "This project is archived, so time can't be logged to it.",


  // Time / standup modal
  "time.workHeader": "Work · {date}",
  "time.workDate": "Work date",
  "time.noProjects": "You're not in any project channel yet. Ask an admin to add you.",
  "time.projectLabel": "Project {n}",
  "time.projectPlaceholder": "Pick a project",
  "time.hoursLabel": "Time",
  "time.hoursPlaceholder": "e.g. 4 or 2.5",
  "time.hoursHint": "Numbers only, e.g. 4 or 0.5",
  "time.taskLabel": "Task description",
  "time.taskItemLabel": "Task {i}",
  "time.taskPlaceholder": "What did you work on?",
  "time.taskLinkLabel": "Link for task {i}",
  "time.taskLinkPlaceholder": "https://...",
  "time.taskHint": "Attach a link to Jira, Figma, Asana, Drive…",
  "time.addTaskItem": "+ Add task",
  "time.removeTaskItem": "Remove task",
  "time.addTaskLink": "+ Add link to task {i}",
  "time.removeTaskLink": "Remove link from task {i}",
  "time.addRow": "+ Add project",
  "time.removeRow": "Remove last",
  "time.offYesterday": "Off yesterday? Use Quick PTO instead.",
  "time.todayHeader": "Today (shared as context, not tracked)",
  "time.planLabel": "What are you planning today?",
  "time.blockersLabel": "Any blockers?",
  "time.blockersHint": "Type “None” if nothing blocks you",

  // PTO modal
  "pto.vacation": "Vacation",
  "pto.sick": "Sick day",
  "pto.holiday": "Holiday",
  "pto.type": "Type",
  "pto.date": "Date",
  "pto.until": "Last day",
  "pto.untilHint": "Same as the first day for a single day off.",
  "pto.rules": "Up to {max} business days at a time. Weekends and your office's holidays are skipped.",

  // Validation errors (response_action "errors")
  "err.workDateMissing": "Pick a work date",
  "err.workDateFuture": "Work date cannot be in the future",
  "err.pickProject": "Pick a project for this row",
  "err.enterHours": "Enter hours for this project",
  "err.enterTask": "Describe what you did",
  "err.enterLink": "Enter a link or remove the link field",
  "err.numbersOnly": "Numbers only, e.g. 0.5 or 0,5",
  "err.hoursRange": "Hours must be between {min} and {max}",
  "err.quarterHours": "Use quarter hours, e.g. {a} or {b}",
  "err.tooLong": "Keep it under {max} characters",
  "err.totalOver": "Total hours for one day cannot exceed 24",
  "err.atLeastOne": "Add at least one project with hours",
  "err.planRequired": "Share at least one line about today",
  "err.blockersRequired": "Type “None” if nothing blocks you",
  "err.ptoType": "Pick vacation or sick day",
  "err.ptoStart": "Pick a date",
  "err.ptoEnd": "Pick the last day (the same date for a single day)",
  "err.ptoOrder": "End date must be on or after the start date",
  "err.ptoMax": "Up to {max} business days at a time",
  "err.ptoNoBusinessDays": "That range has only weekends or holidays",
  // A15 project access (field error on the project select; plain text, no mrkdwn)
  "err.notMember": "You're not in {channel}. Ask {creator} to add you.",
  "err.anAdmin": "an admin",
  "err.projectChannel": "the {project} channel",
  "err.notMemberDm": "Your time for {project} was not saved. {hint}",
  "err.notMemberGeneric": "Your time was not saved: you're not in one of those project channels. Ask an admin to add you.",

  // A19 personal morning reminder
  "morning.title": "Last workday · {date}",
  "morning.noEntries": "You haven't logged your time for {date} yet. Add yesterday's hours and task summaries while they're fresh.",
  "morning.summary": "You logged {hours} across {count} project entries on {date}.",
  "morning.timeOffOnly": "You recorded time off on {date}.",
  "morning.noTask": "Task details not added",
  "morning.logYesterday": "Log missing time",
  "morning.logMore": "Log more time",

  // App Home
  "home.yourWeek": "Your week",
  "home.thisWeek": "This week",
  "home.today": "Today",
  "home.notLogged": "Not logged",
  "home.logTime": "Log time",
  "home.timeOffButton": "Time off",
  "home.byProject": "This month by project",
  "home.noProjectHours": "No hours logged this month yet.",
  "home.timeOff": "Time off",
  "home.vacationLeft": "Vacation left ({year})",
  "home.vacationUsed": "Vacation used ({year})",
  "home.ofAllowance": "{days} of {allowance}",
  "home.sickUsed": "Sick used",
  "home.nextHoliday": "Next holiday",
  "home.noHoliday": "None planned",
  "home.footer": "Updated {time} · /log.",

  // Plurals (picked by Intl.PluralRules; English uses only one/other)
  "plural.days.one": "{n} day",
  "plural.days.few": "{n} days",
  "plural.days.many": "{n} days",
  "plural.days.other": "{n} days",

  // Units
  "unit.hours": "{n}h",
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;
/** Every locale must define every key (enforced by the type and by i18n.test.ts). */
export type Messages = Record<MessageKey, string>;
