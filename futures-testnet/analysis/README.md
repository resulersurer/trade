# OpenAI Futures advisory (testnet branch only)

This module reads **closed** 5m and 15m demo Futures candles using the existing read-only demo client and requests structured advisory output from OpenAI Responses API. It never sends Binance orders, exposes no execution functions, and returns `canSubmitOrder: false` unconditionally.

Run: `node --test futures-testnet/analysis/test/analysis.test.mjs`.

Example from trusted server-side code: `analyzeFutures({ apiKey: process.env.OPENAI_API_KEY, symbol: 'BTCUSDT' })`. Do not expose the API key to browsers. No Next.js endpoint, deployment, scheduler, secrets, or main-branch configuration has been changed. OpenAI calls may incur usage charges; all tests use mocked requests and do not contact external services.

The signal and confidence are model-generated opinions, not verified probability estimates or authorization to trade. Additional data validation, audit storage, risk rules, and testnet verification are required before automated execution.
