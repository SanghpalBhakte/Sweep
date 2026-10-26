/* One row per reminder push that went out, so the daily cron never sends the
   same reminder twice. kind is renewal_2d, renewal_0d, trial_2d or trial_0d. */
create table if not exists public.reminders_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  kind text not null check (kind in ('renewal_2d', 'renewal_0d', 'trial_2d', 'trial_0d')),
  target_date date not null,
  created_at timestamptz not null default now(),
  unique (subscription_id, kind, target_date)
);

create index if not exists idx_reminders_sent_user on public.reminders_sent(user_id);

alter table public.reminders_sent enable row level security;

/* Users can only read their own rows. Only the cron (service role) writes. */
drop policy if exists "Users can view own sent reminders" on public.reminders_sent;
create policy "Users can view own sent reminders"
  on public.reminders_sent for select
  to authenticated
  using ((select auth.uid()) = user_id);
