import { signedRequest } from '@/lib/binance';
import { getSession } from '@/lib/session';
import { db, rateLimit } from '@/lib/db';
import { AppError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session.credentials.binance) throw new AppError('Önce Binance eklentisini bağlayın.', 409);
    await rateLimit(`history:${session.id}`, 60, 3600);
    const url = new URL(request.url);
    const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sql = db();
    const pending = await sql`SELECT id, client_order_id FROM order_intents WHERE session_id = ${session.id}
      AND params->>'symbol' = ${symbol}
      AND (status = 'UNKNOWN' OR (status = 'SUBMITTING' AND submitted_at < NOW() - INTERVAL '90 seconds')) LIMIT 1`;
    for (const intent of pending) {
      try {
        const order = await signedRequest(session.credentials.binance, 'GET', '/fapi/v1/order', { symbol, origClientOrderId: intent.client_order_id });
        if (['FILLED', 'CANCELED', 'EXPIRED', 'EXPIRED_IN_MATCH', 'REJECTED'].includes(order.status)) {
          await sql`UPDATE order_intents SET status = ${Number(order.executedQty) > 0 ? 'EXECUTED' : 'FAILED'}, result = ${JSON.stringify(order)}::jsonb
            WHERE id = ${intent.id} AND session_id = ${session.id} AND status IN ('SUBMITTING', 'UNKNOWN')`;
        }
      } catch { /* Missing or ambiguous orders remain blocked until their state is known. */ }
    }
    const raw = await signedRequest(session.credentials.binance, 'GET', '/fapi/v1/userTrades', { symbol, limit: '500' });
    const trades = raw.sort((a, b) => b.time - a.time).map(trade => ({
      id: trade.id,
      orderId: trade.orderId,
      symbol,
      side: trade.side,
      positionSide: trade.positionSide,
      realizedPnl: trade.realizedPnl,
      price: trade.price,
      quantity: trade.qty,
      quoteQuantity: trade.quoteQty,
      commission: trade.commission,
      commissionAsset: trade.commissionAsset,
      time: trade.time,
      maker: trade.maker,
    }));
    const totals = trades.reduce((result, trade) => {
      const value = Number(trade.quoteQuantity);
      result[trade.side === 'BUY' ? 'bought' : 'sold'] += value;
      return result;
    }, { bought: 0, sold: 0 });
    return Response.json({ symbol, trades, totals, count: trades.length }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 });
  }
}
