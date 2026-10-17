# Supabase region move: Tokyo (ap-northeast-1) → Mumbai (ap-south-1)

**Status: plan only, nothing executed.**

Supabase can't change a project's region in place, so this creates a new project in Mumbai, copies everything over and switches Vercel to it. There are only 2 users, so a short write freeze (≈15–20 min, just don't use the app) is fine. No replication is needed.

The old Tokyo project stays untouched until you're happy, and it is the rollback.

Placeholders:
- `OLD_REF` = `omdfankhcusjuqdzmxjc` (Tokyo)
- `NEW_REF` = ref of the new Mumbai project
- `OLD_DB_URL` / `NEW_DB_URL` = **Session pooler** connection strings from Dashboard → Connect (port 5432, IPv4-friendly), e.g.
  `postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres`

Tools: Supabase CLI ≥ 2.x, `psql` (Postgres 15+ client), Docker running (the CLI runs `pg_dump` from a container).

---

## 0. Pre-flight (old project, read-only)

```bash
mkdir -p ~/sweep-migration && cd ~/sweep-migration

# Full backup, kept as the safety net
supabase db dump --db-url "$OLD_DB_URL" -f old_roles.sql  --role-only
supabase db dump --db-url "$OLD_DB_URL" -f old_schema.sql
supabase db dump --db-url "$OLD_DB_URL" -f old_data.sql   --data-only --use-copy

# Row counts to compare against later
psql "$OLD_DB_URL" -c "select 'auth.users', count(*) from auth.users
  union all select 'subscriptions', count(*) from public.subscriptions
  union all select 'categories', count(*) from public.categories
  union all select 'profiles', count(*) from public.profiles
  union all select 'push_subscriptions', count(*) from public.push_subscriptions
  union all select 'reminder_dispatch_logs', count(*) from public.reminder_dispatch_logs;" > old_counts.txt
```

`supabase db dump` wraps `pg_dump` and leaves out the Supabase-managed schemas, which raw `pg_dump` would fail to restore.

Also write down these dashboard settings, because they are **not** in the dump:
- Auth → URL Configuration: Site URL and redirect URLs
- Auth → Providers (email settings, any OAuth client IDs/secrets)
- Auth → Email templates and custom SMTP (if set)
- Edge Function secrets: `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

## 1. Create the Mumbai project

1. Dashboard → New project → Region **South Asia (Mumbai) / ap-south-1**, same org and plan, Postgres 15.
2. Save the DB password. Copy `NEW_REF`, the project URL, the anon key and the service_role key.
3. Re-enter the auth settings from step 0 (Site URL, redirect URLs, providers, SMTP, templates).
4. Database → Extensions: confirm `uuid-ossp`, `pg_cron`, `pg_net` are available. The migrations enable them, but pg_cron sometimes has to be toggled on in the dashboard first.

## 2. Create the schema by re-running the migrations

```bash
cd "<repo>"
supabase link --project-ref NEW_REF
supabase db push            # applies supabase/migrations/*; seeds are NOT run (good, the data comes from the dump)
```

Check for dashboard-made changes that never made it into migrations:

```bash
supabase db dump --db-url "$NEW_DB_URL" -f ~/sweep-migration/new_schema.sql
diff <(grep -v '^--' ~/sweep-migration/old_schema.sql) <(grep -v '^--' ~/sweep-migration/new_schema.sql)
```

If the diff shows anything real (an extra column, policy or function), apply that SQL to the new project now, and preferably add it as a new migration in the repo.

## 3. Freeze, then dump and restore the data (includes auth users)

1. **Freeze:** both users stop using the app.
2. **Stop the old reminder cron** so Tokyo doesn't keep sending emails after the cutover:
   ```bash
   psql "$OLD_DB_URL" -c "select cron.unschedule('dispatch-sift-reminders-daily');"
   ```
3. Take a fresh data dump. Leave out the tables that `db push` / pg_cron already populated on the new side:
   ```bash
   supabase db dump --db-url "$OLD_DB_URL" -f data.sql --data-only --use-copy \
     -x supabase_migrations.schema_migrations \
     -x cron.job -x cron.job_run_details
   ```
   This includes `auth.users`, `auth.identities` and the rest of `auth.*`, plus all of `public.*` (reference categories and payment methods too).
4. Restore it in one transaction, with triggers/FKs deferred during load:
   ```bash
   psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
     -c 'SET session_replication_role = replica' \
     -f data.sql
   ```
   If it fails on a duplicate key in some managed table (e.g. `storage.buckets`), add `-x <that table>` to the dump and run it again. Because of `--single-transaction`, nothing partial is left behind.
5. Compare the counts with `old_counts.txt` (run the same query against `$NEW_DB_URL`).

Password hashes come across inside `auth.users`, so both users keep their passwords. The new project has a different JWT secret, though, so **existing sessions are invalidated and both users sign in once more**.

## 4. Edge function + cron on the new project

```bash
supabase functions deploy dispatch-reminders --project-ref NEW_REF
supabase secrets set --project-ref NEW_REF APP_URL=... RESEND_API_KEY=... RESEND_FROM_EMAIL=...
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
```

`20240103000000_schedule_dispatch_cron.sql` has the **old** project URL hardcoded as a fallback, so the job `db push` just created points at Tokyo. Reschedule it on the new project:

```sql
select cron.unschedule('dispatch-sift-reminders-daily');
select cron.schedule('dispatch-sift-reminders-daily', '0 8 * * *', $$
  select net.http_post(
    url := 'https://NEW_REF.supabase.co/functions/v1/dispatch-reminders',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')),
    body := '{}'::jsonb);
$$);
```

In the repo, change the fallback URL in that migration (and `project_id` in `supabase/config.toml`, line 44) to `NEW_REF`, so a future reset doesn't point at Tokyo again.

> Side note, not caused by the move: reminders are triggered both by this pg_cron job (08:00 UTC → edge function) and by the Vercel cron in `vercel.json` (06:00 UTC → `/api/reminders/dispatch`). The unique index on `reminder_dispatch_logs` should prevent double-sends, but you probably only want one of them.

## 5. Point Vercel at Mumbai

1. Vercel → Project → Settings → Environment Variables. Update for **Production** (and Preview/Development if they use the same DB):
   - `NEXT_PUBLIC_SUPABASE_URL` → `https://NEW_REF.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → new anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → new service_role key
   - Leave `CRON_SECRET`, `VAPID_*`, `GMAIL_*`, `RESEND_*` and `NEXT_PUBLIC_APP_URL` as they are. Push subscriptions keep working because the VAPID keys don't change and the endpoints were copied with the data.
2. `vercel.json`: change the function region from `hnd1` (Tokyo) to `bom1` (Mumbai), next to the DB:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "framework": "nextjs",
     "regions": ["bom1"],
     "crons": [{ "path": "/api/reminders/dispatch", "schedule": "0 6 * * *" }]
   }
   ```
3. Update your local `.env.local` with the same three values.
4. Commit and push `vercel.json` (plus the migration/config.toml ref fixes, and `supabase/.temp/linked-project.json`, which is tracked and now points at `NEW_REF` after `supabase link`) to trigger a production deploy. `NEXT_PUBLIC_*` values are baked in at build time, so a **new build is required**; changing the env vars alone isn't enough.

## 6. Verify

- Deployment → Functions tab shows region `bom1`.
- Both users can sign in with their existing passwords and see their subscriptions.
- Create, then delete, a test subscription.
- Supabase (new) → Logs: API requests arriving. Old project: no new traffic.
- The next morning: `select * from cron.job_run_details order by start_time desc limit 5;` on the new project, and one reminder email (not two).

## 7. Rollback

The Tokyo project is unchanged apart from the unscheduled cron job, so rolling back is:

1. Vercel → Deployments → the last pre-move production deployment → **Instant Rollback**. It runs with the env vars it was built with, i.e. Tokyo.
2. Put the env vars back to the Tokyo values and revert the `vercel.json` region commit (back to `hnd1`), so the next deploy doesn't flip back to Mumbai. Run `supabase link --project-ref OLD_REF` so the CLI points at Tokyo again.
3. Re-enable the Tokyo cron (the `cron.schedule(...)` block from `20240103000000_schedule_dispatch_cron.sql`, run against `$OLD_DB_URL`), and `cron.unschedule` it on Mumbai.
4. Anything written to Mumbai after the cutover is not in Tokyo. With 2 users, re-enter it by hand, or do a data-only dump of the affected `public` tables from Mumbai and restore it into Tokyo.

Keep Tokyo around (it can be paused) for about 2 weeks before deleting it. Keep `~/sweep-migration/old_*.sql` as the offline backup.
