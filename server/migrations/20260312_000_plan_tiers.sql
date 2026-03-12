-- Add plan_tier column to subscriptions for semantic tier tracking
-- Values: 'starter' | 'professional' | 'business'

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_tier text;

-- Backfill: orgs with a Stripe subscription are paying customers → professional
-- Orgs with no Stripe subscription default to starter
UPDATE subscriptions
SET plan_tier = CASE
  WHEN stripe_subscription_id IS NOT NULL THEN 'professional'
  ELSE 'starter'
END
WHERE plan_tier IS NULL;
