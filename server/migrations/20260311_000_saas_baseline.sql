-- Shiftway SaaS baseline migration (idempotent)

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS slug TEXT;

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'slug') THEN
    ALTER TABLE orgs ALTER COLUMN slug SET NOT NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug_idx ON orgs(slug);

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

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_org_id_idx ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx ON subscriptions(stripe_subscription_id);
