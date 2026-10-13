import { randomUUID } from 'node:crypto';
import { normalizeOrder, signedRequest } from '@/lib/binance';
import { db, rateLimit } from '@/lib/db';
import { getSession } from '@/lib/session';
import { AppError, body, sameOrigin } from '@/lib/security';

export const maxDuration = 60;

export async function POST(request) {
  try {
    sameOrigin(request); const input = await body(request); const session = await getSession();
    if (!session.credentials.binance) throw new AppError('Önce Binance eklentisini bağlayın.', 409);
    await rateLimit(`orders:${session.id}`, 12, 3600);
    const sql = db();
    const pending = await sql`SELECT id FROM order_intents WHERE session_id = ${session.id} AND status IN ('SUBMITTING', 'UNKNOWN') LIMIT 1`;
    if (pending.length) throw new AppError('Son emrin durumu henüz kesinleşmedi. İşlem Defteri ekranını yenileyin.', 409);
    const normalized = await normalizeOrder(input, session.credentials.binance);
    const id = randomUUID(); const clientOrderId = `trade_${id.replaceAll('-', '').slice(0, 24)}`;
    const params = { ...normalized.params, newClientOrderId: clientOrderId };
    await signedRequest(session.credentials.binance, 'POST', '/fapi/v1/order/test', params);
    const metadata = { ...normalized.metadata, input: { symbol: params.symbol, direction: input.direction, action: input.action, amount: input.amount } };
    await sql`INSERT INTO order_intents (id, session_id, credentials_version, client_order_id, params, result)
      VALUES (${id}, ${session.id}, ${session.version}, ${clientOrderId}, ${JSON.stringify(params)}::jsonb, ${JSON.stringify(metadata)}::jsonb)`;
    return Response.json({ id, ...normalized.metadata, symbol: params.symbol, side: params.side, amount: params.quantity,
      amountType: 'base', estimatedQuote: normalized.estimatedQuote, price: normalized.price,
      baseAsset: normalized.market.baseAsset, quoteAsset: normalized.market.quoteAsset, expiresIn: 60 });
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
