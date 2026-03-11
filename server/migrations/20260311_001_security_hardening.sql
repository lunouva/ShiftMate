-- Shiftway security/auth hardening migration (idempotent)

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_org_id_idx ON users(org_id);
CREATE INDEX IF NOT EXISTS users_org_location_id_idx ON users(org_id, location_id);
CREATE INDEX IF NOT EXISTS users_org_role_idx ON users(org_id, role);
CREATE INDEX IF NOT EXISTS magic_links_user_expires_idx ON magic_links(user_id, expires_at);
CREATE INDEX IF NOT EXISTS magic_links_expires_idx ON magic_links(expires_at);
CREATE INDEX IF NOT EXISTS invites_org_expires_idx ON invites(org_id, expires_at);
CREATE INDEX IF NOT EXISTS org_state_updated_at_idx ON org_state(updated_at);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_expires_idx ON email_verification_tokens(user_id, expires_at);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_expires_idx ON password_reset_tokens(user_id, expires_at);
CREATE INDEX IF NOT EXISTS user_refresh_tokens_user_expires_idx ON user_refresh_tokens(user_id, expires_at);
