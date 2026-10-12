# Cloudflare D1 paper-trading persistence

Database: `trade-futures-paper`, UUID `d8a0cb37-4175-45f9-bbd5-bd69b0263a91`.
The Cloudflare database and its 3 tables / 3 indexes have been created remotely. The `wrangler.jsonc` binding `PAPER_DB` is only a **development configuration** and is **not attached to the existing production `trade` Worker**.

- Use `env.PAPER_DB` inside a dedicated Worker to access D1 via prepared statements.
- `store.mjs` exports signal, position, mark, funding and summary repository helpers.
- `worker.mjs` returns HTTP 404 for every request, preventing public read/write exposure.
- No Binance order execution, public write endpoint, scheduled job, API key, or deploy was added.
- Paper calculations remain under `../paper/`; integrate their result lifecycle with the repository in a future authenticated internal handler.
- SQLite/D1 is not PostgreSQL. Existing Spot session and order tables still rely on Neon; they are unchanged.
- The SQL schema is under `migrations/0001_paper.sql`. It mirrors the remote schema; do not apply manually a second time unless reviewed.
- Funding rates need externally validated scheduled events; the store does not independently calculate funding or order slippage.

A subsequent step should introduce concurrency-safe transaction processing and tests with a local D1-compatible engine before wiring it into the paper ledger.
