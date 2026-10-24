-- More shared payment methods: UPI AutoPay, Play Store, App Store.
-- They reuse existing type values, so the type check constraint stays the same.
-- Ids must match BUILTIN in src/lib/constants/paymentMethods.ts. Safe to run more than once.
INSERT INTO public.payment_methods (id, user_id, name, type, is_default)
VALUES
  ('20000000-0000-0000-0000-000000000010', null, 'UPI AutoPay', 'upi', false),
  ('20000000-0000-0000-0000-000000000011', null, 'Play Store', 'other', false),
  ('20000000-0000-0000-0000-000000000012', null, 'App Store', 'other', false)
ON CONFLICT (id) DO UPDATE SET
  user_id = null,
  name = excluded.name,
  type = excluded.type;
