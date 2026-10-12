import { signedRequest } from '@/lib/binance';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { AppError, body, sameOrigin } from '@/lib/security';

export async function POST(request) {
  try {
    sameOrigin(request); const input = await body(request); const session = await getSession();
    if (!/^[0-9a-f-]{36}$/i.test(input.id || '') || input.confirmation !== 'EMRİ ONAYLIYORUM') throw new AppError('Emir onayı geçersiz.');
    if (!session.credentials.binance) throw new AppError('Binance bağlantısı bulunamadı.', 409);
    const sql = db();
    const rows = await sql`UPDATE order_intents SET status = 'SUBMITTING', submitted_at = NOW()
      WHERE id = ${input.id} AND session_id = ${session.id} AND status = 'PREVIEW'
      AND expires_at > NOW() AND credentials_version = ${session.version} RETURNING params`;
    if (!rows.length) throw new AppError('Emir önizlemesi sona ermiş veya daha önce kullanılmış.', 409);
    try {
      const result = await signedRequest(session.credentials.binance, 'POST', '/api/v3/order', rows[0].params);
      await sql`UPDATE order_intents SET status = 'EXECUTED', result = ${JSON.stringify(result)}::jsonb WHERE id = ${input.id}`;
      return Response.json({ status: result.status, orderId: result.orderId, symbol: result.symbol,
        executedQty: result.executedQty, quoteQty: result.cummulativeQuoteQty });
    } catch (error) {
      // Binance timeout means execution is unknown; keep it blocked from retries.
      const unknown = /timeout|unknown/i.test(error.message);
      await sql`UPDATE order_intents SET status = ${unknown ? 'UNKNOWN' : 'FAILED'}, result = ${JSON.stringify({ message: error.message })}::jsonb WHERE id = ${input.id}`;
      throw new AppError(unknown ? 'Binance yanıtı belirsiz. Yeni emir vermeden Binance emir geçmişini kontrol edin.' : error.message, unknown ? 409 : error.status);
    }
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
