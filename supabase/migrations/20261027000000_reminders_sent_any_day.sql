/* Phone reminders now follow the days each person picks (7, 3, 1 days before,
   the day itself), so kind can be renewal_<n>d or trial_<n>d for any n. */
alter table public.reminders_sent drop constraint if exists reminders_sent_kind_check;
alter table public.reminders_sent
  add constraint reminders_sent_kind_check check (kind ~ '^(renewal|trial)_[0-9]{1,3}d$');
