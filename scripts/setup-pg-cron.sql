-- Tempo: status-prompt scheduler (PRD amendments A10, A16; job and path keep the old "morning-ping" name).
--
-- Supabase pg_cron + pg_net call GET {APP_BASE_URL}/api/cron/morning-ping every 15 minutes.
-- A16: the app decides which project channels are due (prompt-office local time in
-- [status_prompt_time, +90 min), weekday, not an office holiday, not yet posted that local day),
-- so every run, including late, repeated or weekend runs, is safe.
--
-- Run once per environment in the Supabase SQL editor. Safe to re-run (idempotent).
-- This is not a Drizzle migration because it depends on per-environment Vault values.
--
-- Prerequisite: two Vault secrets. Create them once (placeholders, never commit real values):
--
--   select vault.create_secret('https://<your-deployed-app-origin>', 'tempo_app_base_url');
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'tempo_cron_secret');
--
--   * base URL: public origin, no trailing slash (e.g. https://tempo.example.com).
--   * cron secret: must equal the CRON_SECRET env var of the deployed app.
--
-- To rotate a value later (no reschedule needed, the job reads Vault on every run):
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'tempo_cron_secret'),
--     '<new value>'
--   );

-- Extensions. On Supabase these may need enabling first under Database -> Extensions
-- (pg_cron installs into schema "cron", pg_net into "extensions"/"net").
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Fail early with a clear message if a secret is missing.
do $check$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'tempo_app_base_url') then
    raise exception 'Vault secret "tempo_app_base_url" is missing. Create it first (see header).';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'tempo_cron_secret') then
    raise exception 'Vault secret "tempo_cron_secret" is missing. Create it first (see header).';
  end if;
end
$check$;

-- Remove any previous version of the job, then (re)create it.
select cron.unschedule(jobid) from cron.job where jobname = 'tempo-morning-ping';

select cron.schedule(
  'tempo-morning-ping',
  '*/15 * * * *', -- every 15 min, every day (UTC). Weekends send nothing; the app filters by local weekday.
  $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'tempo_app_base_url')
           || '/api/cron/morning-ping',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'tempo_cron_secret')
    ),
    timeout_milliseconds := 10000
  );
  $job$
);

-- Verify (run manually after the next quarter hour):
--
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select * from net._http_response order by created desc limit 5;
--
-- Expect status_code 200 in net._http_response. 401 means tempo_cron_secret differs from
-- CRON_SECRET in Vercel; a null status with an error_msg usually means a wrong base URL or timeout.
--
-- To stop the scheduler:
--
--   select cron.unschedule('tempo-morning-ping');
