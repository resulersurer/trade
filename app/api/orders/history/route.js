import { signedRequest } from '@/lib/binance';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/db';
import { AppError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session.credentials.binance) throw new AppError('Önce Binance eklentisini bağlayın.', 409);
    await rateLimit(`history:${session.id}`, 60, 3600);
    const url = new URL(request.url);
    const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const raw = await signedRequest(session.credentials.binance, 'GET', '/api/v3/myTrades', { symbol, limit: '500' });
    const trades = raw.sort((a, b) => b.time - a.time).map(trade => ({
      id: trade.id,
      orderId: trade.orderId,
      symbol,
      side: trade.isBuyer ? 'BUY' : 'SELL',
      price: trade.price,
      quantity: trade.qty,
      quoteQuantity: trade.quoteQty,
      commission: trade.commission,
      commissionAsset: trade.commissionAsset,
      time: trade.time,
      maker: trade.isMaker,
    }));
    const totals = trades.reduce((result, trade) => {
      const value = Number(trade.quoteQuantity);
      result[trade.side === 'BUY' ? 'bought' : 'sold'] += value;
      return result;
    }, { bought: 0, sold: 0 });
    return Response.json({ symbol, trades, totals, count: trades.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 });
  }
}
