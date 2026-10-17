-- Most Sweep users are in India, so new profiles start in INR.
alter table public.profiles alter column currency_preference set default 'INR';
