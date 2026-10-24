-- Shared subscriptions: friends who pay you back, and your UPI ID for pay links.
-- shares is a list like [{"name": "Rahul", "amount": 70, "paid_for": "2026-11-05"}].
-- Existing row level security on both tables already covers these columns. Safe to run more than once.
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS shares JSONB
CHECK (shares IS NULL OR jsonb_typeof(shares) = 'array');

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS upi_id TEXT;

NOTIFY pgrst, 'reload schema';
