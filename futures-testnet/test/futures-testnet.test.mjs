import test from 'node:test';
import assert from 'node:assert/strict';
import { getClosedCandles, normalizeCandles, validateMarketInput, determineSignalAllowed } from '../src/futures-testnet.mjs';

test('only supported futures intervals', () => {
  assert.equal(validateMarketInput('BTCUSDT', '5m', 100).symbol, 'BTCUSDT');
  assert.throws(() => validateMarketInput('BTCUSDT', '1h', 100));
});
test('only closed candles are returned', () => {
  const rows = [[1000, '1', '2', '0.5', '1.5', '20', 2000], [2000, '1', '2', '0.5', '1.5', '20', 3000]];
  assert.equal(normalizeCandles(rows, 2500).length, 1);
});
test('client is GET-only and demo-only', async () => {
  let called = false;
  const fetchImpl = async (url, opts) => {
    called = true;
    assert.match(url, /^https:\/\/demo-fapi\.binance\.com\/fapi\/v1\/klines\?/);
    assert.equal(opts.method, 'GET');
    return { ok: true, json: async () => [[1000, '1', '2', '0.5', '1.5', '20', 2000]] };
  };
  const result = await getClosedCandles({ fetchImpl, now: 2500 });
  assert.equal(called, true);
  assert.equal(result.length, 1);
});
test('cannot submit any order', () => {
  assert.equal(determineSignalAllowed({ candles: [], riskEnabled: true }).canSubmitOrder, false);
});
