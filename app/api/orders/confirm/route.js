import { normalizeOrder, requireFutures, signedRequest } from '@/lib/binance';
import { uncertainExecution } from '@/lib/futures.mjs';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { AppError, body, sameOrigin } from '@/lib/security';

export const maxDuration = 60;

export async function POST(request) {
  try {
    sameOrigin(request); const input = await body(request); const session = await getSession();
    if (!/^[0-9a-f-]{36}$/i.test(input.id || '') || input.confirmation !== 'EMRİ ONAYLIYORUM') throw new AppError('Emir onayı geçersiz.');
    if (!session.credentials.binance) throw new AppError('Binance bağlantısı bulunamadı.', 409);
    requireFutures(session.credentials.binance);
    const sql = db();
    const rows = await sql`UPDATE order_intents SET status = 'SUBMITTING', submitted_at = NOW()
      WHERE id = ${input.id} AND session_id = ${session.id} AND status = 'PREVIEW'
      AND expires_at > NOW() AND credentials_version = ${session.version} RETURNING params, result, expires_at`;
    if (!rows.length) throw new AppError('Emir önizlemesi sona ermiş veya daha önce kullanılmış.', 409);
    let submitted = false;
    try {
      const { params, result: metadata } = rows[0];
      if (metadata?.marketType !== 'USDS_FUTURES') throw new AppError('Bu önizleme Futures için oluşturulmadı. Yeni emir hazırlayın.', 409);
      // Recheck account settings and position immediately before submitting the saved quantity.
      const current = await normalizeOrder(metadata.input, session.credentials.binance, params.quantity);
      if (current.metadata.positionMode !== metadata.positionMode ||
        current.metadata.leverage !== metadata.leverage || current.metadata.marginType !== metadata.marginType ||
        current.params.side !== params.side || current.params.positionSide !== params.positionSide) {
        throw new AppError('Kaldıraç, marjin türü veya pozisyon modu değişti. Yeni önizleme oluşturun.', 409);
      }
      if (new Date(rows[0].expires_at).getTime() <= Date.now()) throw new AppError('Önizleme süresi doldu. Yeni emir hazırlayın.', 409);
      submitted = true;
      const result = await signedRequest(session.credentials.binance, 'POST', '/fapi/v1/order', params);
      await sql`UPDATE order_intents SET status = ${result.status === 'FILLED' ? 'EXECUTED' : 'UNKNOWN'}, result = ${JSON.stringify(result)}::jsonb WHERE id = ${input.id}`;
      return Response.json({ status: result.status, orderId: result.orderId, symbol: result.symbol,
        executedQty: result.executedQty, quoteQty: result.cumQuote });
    } catch (error) {
      // Binance timeout means execution is unknown; keep it blocked from retries.
      const unknown = submitted && (uncertainExecution(error) || error.definitiveRejection !== true);
      await sql`UPDATE order_intents SET status = ${unknown ? 'UNKNOWN' : 'FAILED'}, result = ${JSON.stringify({ message: error.message })}::jsonb WHERE id = ${input.id}`;
      throw new AppError(unknown ? 'Binance yanıtı belirsiz. Yeni emir vermeden Binance emir geçmişini kontrol edin.' : error.message, unknown ? 409 : error.status);
    }
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
