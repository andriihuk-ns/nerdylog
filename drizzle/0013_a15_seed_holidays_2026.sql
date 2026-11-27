-- Custom SQL migration: 2026 company holidays per office (amendment A15 (5)), names in Ukrainian.
-- Idempotent: ON CONFLICT on (office_id, holiday_date) does nothing, so admin edits made before this
-- runs are kept. Offices are looked up by code (seeded in 0011); a missing office inserts nothing.

INSERT INTO "company_holidays" ("office_id", "holiday_date", "name")
SELECT o."id", v."holiday_date"::date, v."name"
FROM (VALUES
  ('UA', '2026-01-01', 'Новий рік'),
  ('UA', '2026-04-13', 'Великодній понеділок'),
  ('UA', '2026-05-01', 'День праці'),
  ('UA', '2026-07-15', 'День Української Державності'),
  ('UA', '2026-08-24', 'День Незалежності України'),
  ('UA', '2026-10-01', 'День Захисників і Захисниць України'),
  ('UA', '2026-12-25', 'Різдво Христове'),
  ('PL', '2026-01-01', 'Новий рік'),
  ('PL', '2026-01-06', 'Богоявлення'),
  ('PL', '2026-04-06', 'Великодній понеділок'),
  ('PL', '2026-05-01', 'День праці'),
  ('PL', '2026-06-04', 'Свято Тіла й Крові Христових'),
  ('PL', '2026-11-11', 'День незалежності Польщі'),
  ('PL', '2026-12-25', 'Різдво Христове')
) AS v("code", "holiday_date", "name")
JOIN "offices" o ON o."code" = v."code"
ON CONFLICT ("office_id", "holiday_date") DO NOTHING;
