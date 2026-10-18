-- =============================================================================
-- Sift - Scheduled pg_cron Job for Daily Automated Reminder Dispatch
-- Migration: 20240103000000_schedule_dispatch_cron.sql
-- =============================================================================

-- Ensure pg_cron and pg_net extensions are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- Schedule Daily Reminder Evaluation (Runs every morning at 08:00 UTC)
-- -----------------------------------------------------------------------------

-- Unschedule previous job if it exists
select cron.unschedule('dispatch-sift-reminders-daily')
where exists (
  select 1 from cron.job where jobname = 'dispatch-sift-reminders-daily'
);

-- Schedule daily trigger calling the Edge Function
select
  cron.schedule(
    'dispatch-sift-reminders-daily',
    '0 8 * * *', -- At 08:00 UTC every day
    $$
    select
      net.http_post(
        url := (select coalesce(current_setting('app.settings.supabase_url', true), 'https://zsycpokyuqzilptmdcme.supabase.co') || '/functions/v1/dispatch-reminders'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
  );
