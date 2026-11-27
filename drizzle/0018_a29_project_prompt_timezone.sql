-- A29: the status prompt has its own time zone; null keeps the office zone.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "status_prompt_timezone" text;
