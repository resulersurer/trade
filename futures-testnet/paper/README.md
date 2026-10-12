# Futures Paper Trading
In-memory offline ledger for LONG / SHORT / WAIT signals. Simulated margin, leverage, entry/exit slippage, trading fees, mark-to-market price updates, funding cash flows, closed trade net PnL and win rate. Entirely separate from existing Spot routes and the deployed Worker.

Run offline tests: `node --test futures-testnet/paper/test/paper.test.mjs`.

Example:
```js
import {PaperLedger} from './src/paper.mjs';
const ledger = new PaperLedger({cash:1000,feeRate:0.0004,slippage:0.0002});
ledger.signal({id:'signal-1',symbol:'BTCUSDT',signal:'LONG',confidence:70,time:Date.now()});
ledger.open({id:'sim-1',signalId:'signal-1',price:100000,margin:10,leverage:2,time:Date.now()});
ledger.mark({id:'sim-1',price:100500,time:Date.now()});
console.log(ledger.report());
```

**Limits:** The ledger is **in memory only**; use `snapshot()` and a secure persistent store in a later stage. Funding rates must be externally supplied at actual funding times; they are NOT fetched automatically. No liquidation, risk engine, drawdown series, funding schedule or order book fill simulator is implemented. Fee and slippage values are configurable approximations, not actual exchange executions. No Binance or OpenAI calls or real/testnet orders are performed by this module.
