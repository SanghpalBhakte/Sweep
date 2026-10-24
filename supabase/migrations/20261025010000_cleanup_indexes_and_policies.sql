-- Cleanup from the Supabase performance check. Safe to run more than once.

-- 1. Duplicate indexes. Each is covered by another index that starts with the same
--    column, and the app never filters on the extra columns. Foreign key indexes stay.
DROP INDEX IF EXISTS public.idx_subscriptions_category;  -- (user_id, category_id)
DROP INDEX IF EXISTS public.idx_subscriptions_renewal;   -- (user_id, next_renewal_date)
DROP INDEX IF EXISTS public.idx_subscriptions_status;    -- (user_id, status)
DROP INDEX IF EXISTS public.idx_dispatch_user_id;        -- covered by idx_dispatch_logs_user_sub
DROP INDEX IF EXISTS public.idx_reminders_user_id;       -- covered by idx_reminders_user_date

-- 2. payment_methods had two SELECT policies (own rows, and shared rows with no owner).
--    One SELECT policy plus separate write policies gives the same access, checked once.
DROP POLICY IF EXISTS "Users can manage own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can view system payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can view own and system payment methods" ON public.payment_methods;

CREATE POLICY "Users can view own and system payment methods"
  ON public.payment_methods FOR SELECT
  USING (user_id IS NULL OR (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can add own payment methods"
  ON public.payment_methods FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own payment methods"
  ON public.payment_methods FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON public.payment_methods FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- 3. Reminders are sent by the Vercel cron at /api/reminders/dispatch. Turn off the old
--    pg_cron job from 20240103000000 wherever it was created; it called an edge function
--    that is no longer in the repo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dispatch-sift-reminders-daily';
  END IF;
END $$;
