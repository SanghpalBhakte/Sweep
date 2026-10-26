/* Phone reminders: call /api/cron/reminders every hour, so each person gets theirs
   from 9 AM in their own timezone, and a push that a busy push service refused is
   tried again an hour later. The route claims each reminder in reminders_sent first,
   so this and the daily Vercel cron never send the same reminder twice.

   Needs the cron secret in Vault (run once in the SQL editor, with the real value):
     select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   Until then the call is refused with 401 and nothing is sent. */

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'sweep-push-reminders-hourly';

select cron.schedule(
  'sweep-push-reminders-hourly',
  '5 * * * *', -- five past every hour
  $$
  select net.http_get(
    url := 'https://sweep-subs.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1), '')
    ),
    timeout_milliseconds := 55000
  );
  $$
);
