import { randomUUID } from 'node:crypto';
import { normalizeOrder, signedRequest } from '@/lib/binance';
import { db, rateLimit } from '@/lib/db';
import { getSession } from '@/lib/session';
import { AppError, body, sameOrigin } from '@/lib/security';

export async function POST(request) {
  try {
    sameOrigin(request); const input = await body(request); const session = await getSession();
    if (!session.credentials.binance) throw new AppError('Önce Binance eklentisini bağlayın.', 409);
    await rateLimit(`orders:${session.id}`, 12, 3600);
    const normalized = await normalizeOrder(input);
    const id = randomUUID(); const clientOrderId = `trade_${id.replaceAll('-', '').slice(0, 24)}`;
    const params = { ...normalized.params, newClientOrderId: clientOrderId };
    await signedRequest(session.credentials.binance, 'POST', '/api/v3/order/test', params);
    const sql = db();
    await sql`INSERT INTO order_intents (id, session_id, credentials_version, client_order_id, params)
      VALUES (${id}, ${session.id}, ${session.version}, ${clientOrderId}, ${JSON.stringify(params)}::jsonb)`;
    return Response.json({ id, symbol: params.symbol, side: params.side, amount: params.quoteOrderQty || params.quantity,
      amountType: params.quoteOrderQty ? 'quote' : 'base', estimatedQuote: normalized.estimatedQuote, price: normalized.price,
      baseAsset: normalized.market.baseAsset, quoteAsset: normalized.market.quoteAsset, expiresIn: 60 });
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
