# Futures Testnet (read-only starter)

Safe, isolated market-data experiment for the existing Next.js Trade Desk. **This module does not place or sign orders**, on testnet or production.

- `src/futures-testnet.mjs` reads closed 5m and 15m USDT-M futures candles from `https://demo-fapi.binance.com/fapi/v1/klines`.
- `test/futures-testnet.test.mjs` runs offline with mocked responses; it checks demo-only GET requests and an always-denied execution signal.
- No API keys, secrets, databases, schedulers or live trade APIs are used.

Run from the repository root:

```sh
node --test futures-testnet/test/futures-testnet.test.mjs
```

Existing Spot API files and deployment are untouched. Nothing is wired into Next.js routes: this branch will not automatically invoke Binance or send orders.

## Future integration requirements
1. Add a new authenticated, rate-limited **read-only** demo market endpoint; keep production and demo hosts isolated.
2. Connect the OpenAI analysis in an advisory-only mode; model output must never directly authorize an order.
3. Introduce an auditable deterministic risk engine (leverage/margin limits, position sizing, protective orders, stale-price checks, maximum daily loss, kill switch).
4. For a future testnet-only order executor, require a strict demo host allowlist and hard-disable live orders; use only separate demo credentials and reconcile uncertain orders before retry.
5. Add separate lifecycle storage, idempotency, paper-trading and testnet validation before discussing live trading.

Offline tests do not establish connectivity to Binance; no live/testnet request was made during validation.
