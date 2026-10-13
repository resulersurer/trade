CREATE TABLE IF NOT EXISTS vault_sessions (
  id text PRIMARY KEY,
  secrets text,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS order_intents (
  id uuid PRIMARY KEY,
  session_id text NOT NULL REFERENCES vault_sessions(id),
  credentials_version integer NOT NULL,
  client_order_id text NOT NULL UNIQUE,
  params jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PREVIEW',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL DEFAULT NOW() + INTERVAL '60 seconds',
  submitted_at timestamptz
);
CREATE INDEX IF NOT EXISTS orders_by_session ON order_intents(session_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS one_uncertain_order_per_session ON order_intents(session_id)
  WHERE status IN ('SUBMITTING', 'UNKNOWN');

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  "window" bigint NOT NULL,
  count integer NOT NULL DEFAULT 1
);
