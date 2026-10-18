-- Supabase advisor "extension_in_public": keep pg_net out of the public schema.
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
