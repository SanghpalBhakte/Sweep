# Supabase Database Guide for Sweep

This directory contains the database migration schema, seed data, and Row Level Security (RLS) policies for Sweep.

## Files

- `migrations/20240101000000_initial_schema.sql`: Contains table definitions, indexes, RLS policies, and triggers for:
  - `profiles`
  - `categories`
  - `payment_methods`
  - `subscriptions`
  - `reminders`
  - `subscription_events`
- `seeds/`: Default system categories and payment methods.

## Setup Options

### Option A: Using the Supabase Web Dashboard (Easiest)

1. Go to your project on [supabase.com](https://supabase.com).
2. Open the **SQL Editor**.
3. Copy and paste the contents of `migrations/20240101000000_initial_schema.sql` and run it.
4. Copy and paste the files in `seeds/` (00 and 01) and run them.
5. In Project Settings > API, copy your `Project URL` and `anon public` key to `.env.local` in your Next.js root.

### Option B: Using the Supabase CLI

```bash
# Initialize and start local Supabase instance
npx supabase start

# Apply migrations
npx supabase db reset
```

## Deploys and reminders

- The repo is linked to the live project through the Supabase GitHub integration. Every push to `main` applies new files in `migrations/` and the `[remotes.production]` settings in `config.toml`. Add schema changes as new migration files only; do not also run them in the dashboard, or the migration history stops matching and the deploy step fails.
- Login addresses (Site URL and Redirect URLs) live in `config.toml` under `[remotes.production.auth]`. Changes made only in the dashboard are overwritten on the next push.
- Reminders are sent by the Vercel cron (`/api/reminders/dispatch` in `vercel.json`), not by an edge function.

## Security & Row Level Security (RLS)

All user-facing tables have Row Level Security enabled:
- Each user can only select, insert, update, and delete their own subscriptions, payment methods, and profiles.
- Categories can be system-wide (`user_id IS NULL`) or user-created.
- Service role keys should never be exposed to the browser client.
