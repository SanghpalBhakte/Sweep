-- Built-in categories and payment methods, shared by everyone (user_id IS NULL).
--
-- The Mumbai project was created from a squashed schema that only seeded 6 of the
-- 14 categories and none of the payment methods. The app filled the gap by inserting
-- missing built-in categories under whichever user picked them first, which then
-- clashed (same id) for every other user. This makes all of them shared rows.
-- Safe to run more than once.

-- 1. Categories: claim the canonical ids as shared rows and add the missing ones
INSERT INTO public.categories (id, user_id, name, slug, color, icon)
VALUES
  ('10000000-0000-0000-0000-000000000001', null, 'Software & Development', 'software-dev', 'moss', 'terminal'),
  ('10000000-0000-0000-0000-000000000002', null, 'Infrastructure & Cloud', 'infra-cloud', 'slate', 'server'),
  ('10000000-0000-0000-0000-000000000003', null, 'Productivity & Notes', 'productivity', 'ochre', 'edit-3'),
  ('10000000-0000-0000-0000-000000000004', null, 'Media & Reading', 'media-reading', 'terracotta', 'book-open'),
  ('10000000-0000-0000-0000-000000000005', null, 'Health & Routine', 'health-routine', 'sage', 'heart'),
  ('10000000-0000-0000-0000-000000000006', null, 'Utilities & Sync', 'utilities-sync', 'stone', 'home'),
  ('10000000-0000-0000-0000-000000000007', null, 'Education & Learning', 'education-learning', 'indigo', 'graduation-cap'),
  ('10000000-0000-0000-0000-000000000008', null, 'Finance & Money', 'finance-money', 'emerald', 'dollar-sign'),
  ('10000000-0000-0000-0000-000000000009', null, 'Food & Delivery', 'food-delivery', 'amber', 'utensils'),
  ('10000000-0000-0000-0000-000000000010', null, 'Shopping & Commerce', 'shopping-commerce', 'rose', 'shopping-bag'),
  ('10000000-0000-0000-0000-000000000011', null, 'Travel & Transport', 'travel-transport', 'sky', 'plane'),
  ('10000000-0000-0000-0000-000000000012', null, 'Entertainment & Games', 'entertainment-games', 'violet', 'gamepad-2'),
  ('10000000-0000-0000-0000-000000000013', null, 'Family & Home', 'family-home', 'teal', 'users'),
  ('10000000-0000-0000-0000-000000000014', null, 'Other', 'other', 'stone', 'folder')
ON CONFLICT (id) DO UPDATE SET
  user_id = null,
  name = excluded.name,
  slug = excluded.slug,
  color = excluded.color,
  icon = excluded.icon;

-- 2. Payment methods: allow shared rows and the types the app offers
ALTER TABLE public.payment_methods ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check;
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_type_check
  CHECK (type IN ('credit_card', 'debit_card', 'bank_account', 'upi', 'paypal', 'apple_pay', 'google_pay', 'cash', 'other'));

DROP POLICY IF EXISTS "Users can view system payment methods" ON public.payment_methods;
CREATE POLICY "Users can view system payment methods"
  ON public.payment_methods FOR SELECT
  USING (user_id IS NULL);

INSERT INTO public.payment_methods (id, user_id, name, type, is_default)
VALUES
  ('20000000-0000-0000-0000-000000000004', null, 'UPI', 'upi', false),
  ('20000000-0000-0000-0000-000000000001', null, 'Credit card', 'credit_card', false),
  ('20000000-0000-0000-0000-000000000002', null, 'Debit card', 'debit_card', false),
  ('20000000-0000-0000-0000-000000000003', null, 'Net banking', 'bank_account', false),
  ('20000000-0000-0000-0000-000000000007', null, 'Google Pay', 'google_pay', false),
  ('20000000-0000-0000-0000-000000000005', null, 'PayPal', 'paypal', false),
  ('20000000-0000-0000-0000-000000000006', null, 'Apple Pay', 'apple_pay', false),
  ('20000000-0000-0000-0000-000000000008', null, 'Cash', 'cash', false),
  ('20000000-0000-0000-0000-000000000009', null, 'Other', 'other', false)
ON CONFLICT (id) DO UPDATE SET
  user_id = null,
  name = excluded.name,
  type = excluded.type;

NOTIFY pgrst, 'reload schema';
