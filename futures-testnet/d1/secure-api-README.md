# Protected D1 signal persistence (source only)

`secure-api.mjs` is **not deployed or routed**. It accepts advisory LONG/SHORT/WAIT signals and inserts them into `paper_signals` using a D1 binding after authentication. It has no exchange client and cannot place orders.

Configuration required before any deployment:
- Bind `PAPER_DB` to the D1 paper-trading database.
- Provision a strong random `WRITE_TOKEN` as a **Cloudflare Worker secret** (never commit it, never expose it to browser code).
- Mount `handleSignal` only on a separate protected POST path, with network protections and appropriate rate limits.
- Never expose endpoint without the secret and verify unauthorized requests return 401.
- The current deployed development Worker remains GET /health-only.

Run mocked offline tests: `node --test futures-testnet/d1/test/secure-api.test.mjs`.
`WRITE_TOKEN` is not configured as part of this source-only change.
