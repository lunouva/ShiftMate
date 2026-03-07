-- ============================================================
-- ShiftWay SaaS Migration
-- Run via: node scripts/migrate_saas.js
-- Safe to re-run (all statements are idempotent)
-- ============================================================

-- 1. Add slug column to orgs (nullable first so backfill can run)
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Backfill existing orgs: derive slug from name
--    lowercased, non-alphanumeric chars → hyphen, collapse multiple hyphens,
--    strip leading/trailing hyphens, append short id suffix to avoid collisions.
UPDATE orgs
SET slug = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ),
    '-{2,}', '-', 'g'
  )
) || '-' || substring(id::text, 1, 6)
WHERE slug IS NULL;

-- 3. Enforce NOT NULL + UNIQUE now that all rows have a value
ALTER TABLE orgs ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug_idx ON orgs(slug);

-- 4. Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  stripe_customer_id     text,
  stripe_subscription_id text        UNIQUE,
  status                 text        NOT NULL DEFAULT 'trialing',
  plan                   text,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- One subscription row per org
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_org_id_idx ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx ON subscriptions(stripe_subscription_id);
