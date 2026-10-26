/* Phone reminders go out at 9 AM in each person's own timezone. The app saves the
   device's timezone here; everyone starts on India time. */
alter table public.profiles
  add column if not exists timezone text not null default 'Asia/Kolkata';
