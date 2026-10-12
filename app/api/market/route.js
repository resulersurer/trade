import { publicRequest } from '@/lib/binance';
import { AppError } from '@/lib/security';

export async function GET(request) {
  try {
    const symbol = (new URL(request.url).searchParams.get('symbol') || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const [ticker, candles] = await Promise.all([
      publicRequest('/api/v3/ticker/24hr', { symbol }),
      publicRequest('/api/v3/klines', { symbol, interval: '1h', limit: '48' }),
    ]);
    return Response.json({ symbol, price: ticker.lastPrice, change: ticker.priceChangePercent, high: ticker.highPrice, low: ticker.lowPrice,
      candles: candles.map(c => ({ time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] })) });
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
