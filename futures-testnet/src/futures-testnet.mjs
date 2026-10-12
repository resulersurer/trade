// Binance USDⓈ-M Futures DEMO market-data client.
// Read-only by construction: no API keys, signing, or order methods.
// Never routes requests to production Binance Futures.
export const FUTURES_DEMO_BASE = 'https://demo-fapi.binance.com';
const INTERVALS = new Set(['5m', '15m']);

export function validateMarketInput(symbol = 'BTCUSDT', interval = '5m', limit = 100) {
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error('Invalid symbol');
  if (!INTERVALS.has(interval)) throw new Error('Only 5m or 15m are supported');
  if (!Number.isInteger(limit) || limit < 3 || limit > 500) throw new Error('Invalid candle limit');
  return { symbol, interval, limit };
}

export function normalizeCandles(rows, now = Date.now()) {
  if (!Array.isArray(rows)) throw new Error('Invalid market data');
  // Drop unfinished candle to avoid partial-candle signals.
  return rows.filter(row => Array.isArray(row) && Number(row[6]) < now).map(row => ({
    openTime: Number(row[0]), closeTime: Number(row[6]),
    open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
    close: Number(row[4]), volume: Number(row[5]),
  }));
}

export async function getClosedCandles({ symbol = 'BTCUSDT', interval = '5m', limit = 100, fetchImpl = fetch, now = Date.now() } = {}) {
  const args = validateMarketInput(symbol, interval, limit);
  const url = new URL('/fapi/v1/klines', FUTURES_DEMO_BASE);
  for (const [key, value] of Object.entries(args)) url.searchParams.set(key, String(value));
  const response = await fetchImpl(url.toString(), { method: 'GET', signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Futures demo market data request failed (${response.status})`);
  return normalizeCandles(await response.json(), now);
}

export function determineSignalAllowed({ candles, riskEnabled = false }) {
  // No execution engine installed; always fail closed.
  return { action: 'WAIT', canSubmitOrder: false, reason: riskEnabled ? 'No audited execution and risk engine installed' : 'Risk engine disabled', candleCount: candles?.length ?? 0 };
}
