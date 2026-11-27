import type { Messages } from "./en";

/**
 * A14: Ukrainian bot copy. Friendly informal "ти", natural phrasing (not a literal translation).
 * Typed as `Messages`, so a missing or extra key fails the type check.
 */
export const uk: Messages = {
  // Common
  "common.cancel": "Скасувати",
  "common.close": "Закрити",
  "common.submit": "Надіслати",
  "common.save": "Зберегти",
  "common.openWeb": "Відкрити веб-панель",
  "common.notLinked":
    "Тебе ще немає в nerdylog. Увійди один раз на <{url}|nerdylog> або попроси адміна синхронізувати команду зі Slack.",
  "common.formExpired": "Ця форма вже застаріла. Відкрий її ще раз.",
  "common.formNotYours": "Ця форма належить комусь іншому.",
  "common.loadFailed": "Не вдалося завантажити nerdylog. Спробуй ще раз.",
  "common.saveFailedDm": "nerdylog не зміг зберегти твій останній запис. Спробуй ще раз або скористайся веб-панеллю.",

  // Modal titles (≤ 24 characters)
  "title.standup": "Щоденний статус",
  "title.log": "Записати час",
  "title.pto": "Відпустка / лікарняний",

  // Slash command replies
  "cmd.unknown": "Не знаю команди {command}. Спробуй /log або /pto.",
  "cmd.noTrigger": "Slack не передав потрібних даних. Спробуй ще раз.",
  "cmd.openFailed": "nerdylog не зміг відкрити форму. Спробуй ще раз.",
  "cmd.logHelp":
    "*Швидкий запис часу:*\n• `/log` — відкрити форму\n• `/log 2,5 Опис задачі` — одразу підставити час (можна `0,5` або `0.5`) та опис\n• `/pto` — оформити відпустку чи лікарняний",

  // A16 project channel prompt
  "prompt.notMember": "Попроси {creator} додати тебе до цього проєкту.",
  "prompt.inactive": "Цей проєкт в архіві, тож час на нього записати не можна.",


  // Time / standup modal
  "time.workHeader": "Робота · {date}",
  "time.workDate": "Дата роботи",
  "time.noProjects": "Тебе ще немає в жодному каналі проєкту. Попроси адміна додати тебе.",
  "time.projectLabel": "Проєкт {n}",
  "time.projectPlaceholder": "Обери проєкт",
  "time.hoursLabel": "Час",
  "time.hoursPlaceholder": "напр. 4 або 2,5",
  "time.hoursHint": "Лише цифри, напр. 4 або 0,5",
  "time.taskLabel": "Опис задачі",
  "time.taskItemLabel": "Задача {i}",
  "time.taskPlaceholder": "Коротко опиши, що зроблено",
  "time.taskLinkLabel": "Посилання до задачі {i}",
  "time.taskLinkPlaceholder": "https://...",
  "time.taskHint": "Можна прикріпити посилання на Jira, Figma, Asana, Drive…",
  "time.addTaskItem": "+ Додати задачу",
  "time.removeTaskItem": "Прибрати задачу",
  "time.addTaskLink": "+ Додати посилання",
  "time.removeTaskLink": "Прибрати посилання",
  "time.addRow": "+ Додати проєкт",
  "time.removeRow": "Прибрати останній",
  "time.offYesterday": "Вчора був вихідний? Тоді обери швидку відпустку / лікарняний.",
  "time.todayHeader": "Сьогодні (лише контекст, години не рахуються)",
  "time.planLabel": "Що плануєш сьогодні?",
  "time.blockersLabel": "Є блокери?",
  "time.blockersHint": "Напиши «Немає», якщо нічого не блокує",

  // PTO modal
  "pto.vacation": "Відпустка",
  "pto.sick": "Лікарняний",
  "pto.holiday": "Свято",
  "pto.type": "Тип",
  "pto.date": "Дата",
  "pto.until": "Останній день",
  "pto.untilHint": "Та сама дата, що й перший день, якщо це лише один день.",
  "pto.rules": "До {max} робочих днів за раз. Вихідні та свята твого офісу не рахуються.",

  // Validation errors
  "err.workDateMissing": "Обери дату роботи",
  "err.workDateFuture": "Дата роботи не може бути в майбутньому",
  "err.pickProject": "Обери проєкт для цього рядка",
  "err.enterHours": "Вкажи години для цього проєкту",
  "err.enterTask": "Коротко опиши, що зроблено",
  "err.enterLink": "Встав посилання або прибери поле посилання",
  "err.numbersOnly": "Використовуй лише цифри, напр. 0,5 або 0.5",
  "err.hoursRange": "Години мають бути від {min} до {max}",
  "err.quarterHours": "Вказуй години кроком у чверть години, напр. {a} або {b}",
  "err.tooLong": "Не більше {max} символів",
  "err.totalOver": "За один день не можна записати більше 24 годин",
  "err.atLeastOne": "Додай хоча б один проєкт із годинами",
  "err.planRequired": "Напиши хоча б рядок про плани на сьогодні",
  "err.blockersRequired": "Напиши «Немає», якщо нічого не блокує",
  "err.ptoType": "Обери: відпустка чи лікарняний",
  "err.ptoStart": "Обери дату",
  "err.ptoEnd": "Обери останній день (ту саму дату, якщо це один день)",
  "err.ptoOrder": "Останній день не може бути раніше за перший",
  "err.ptoMax": "Не більше {max} робочих днів за раз",
  "err.ptoNoBusinessDays": "У цьому проміжку лише вихідні або свята",
  "err.notMember": "Тебе немає в {channel}. Попроси {creator} додати тебе.",
  "err.anAdmin": "адміна",
  "err.projectChannel": "каналі проєкту {project}",
  "err.notMemberDm": "Час для {project} не збережено. {hint}",
  "err.notMemberGeneric": "Час не збережено: тебе немає в одному з цих каналів проєктів. Попроси адміна додати тебе.",

  // App Home
  "home.yourWeek": "Твій тиждень",
  "home.thisWeek": "Цього тижня",
  "home.today": "Сьогодні",
  "home.notLogged": "Ще не записано",
  "home.logTime": "Записати час",
  "home.timeOffButton": "Відпустка / лікарняний",
  "home.byProject": "Цього місяця за проєктами",
  "home.noProjectHours": "Цього місяця ще немає записаних годин.",
  "home.timeOff": "Відпустки й лікарняні",
  "home.vacationLeft": "Залишок відпустки ({year})",
  "home.vacationUsed": "Використано відпустки ({year})",
  "home.ofAllowance": "{days} з {allowance}",
  "home.sickUsed": "Лікарняні",
  "home.nextHoliday": "Найближче свято",
  "home.noHoliday": "Поки не заплановано",
  "home.footer": "Оновлено о {time} · Години беруться зі стендапів і /log.",

  // Plurals: 1 день, 2–4 дні, 5+ днів, дробові — дня
  "plural.days.one": "{n} день",
  "plural.days.few": "{n} дні",
  "plural.days.many": "{n} днів",
  "plural.days.other": "{n} дня",

  // Units
  "unit.hours": "{n} год",
};
