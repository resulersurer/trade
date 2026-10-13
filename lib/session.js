import 'server-only';
import { cookies } from 'next/headers';
import { db, rateLimit } from './db';
import { AppError, encryptionKey, hash, newToken, seal, unseal } from './security';

const cookieName = process.env.NODE_ENV === 'production' ? '__Host-trade_session' : 'trade_session';
export async function getSession() {
  encryptionKey();
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError('Oturum gerekli. Sayfayı yenileyin.', 401);
  const sql = db();
  const [session] = await sql`SELECT id, secrets, version, expires_at FROM vault_sessions WHERE id = ${hash(token)} AND expires_at > NOW()`;
  if (!session) throw new AppError('Oturum süresi doldu. Anahtarları yeniden ekleyin.', 401);
  return { ...session, credentials: session.secrets ? unseal(session.secrets, session.id) : {} };
}

export async function ensureSession(request) {
  try { return await getSession(); }
  catch (error) { if (error.status !== 401) throw error; }
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'local';
  await rateLimit(`session:${hash(ip)}`, 20, 3600);
  const token = newToken(); const id = hash(token); const sql = db();
  const [row] = await sql`INSERT INTO vault_sessions (id) VALUES (${id}) RETURNING expires_at`;
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/', maxAge: 30 * 24 * 3600,
  });
  return { id, credentials: {}, version: 0, expires_at: row.expires_at };
}

export async function saveCredentials(session, credentials) {
  const sql = db();
  const rows = await sql`UPDATE vault_sessions SET secrets = ${seal(credentials, session.id)}, version = version + 1
    WHERE id = ${session.id} AND version = ${session.version}
    AND NOT EXISTS (SELECT 1 FROM order_intents WHERE session_id = ${session.id} AND status IN ('SUBMITTING', 'UNKNOWN'))
    RETURNING id`;
  if (!rows.length) throw new AppError('Bekleyen bir emir veya eşzamanlı güncelleme var. Önce emir durumunu kontrol edin ve sayfayı yenileyin.', 409);
}

export function publicSession(session) {
  const { binance, openai } = session.credentials;
  return {
    expiresAt: session.expires_at,
    binance: { connected: binance?.marketType === 'USDS_FUTURES' && binance?.authType === 'RSA', checkedAt: binance?.checkedAt, canTrade: !!binance?.canTrade,
      marketType: binance?.marketType, authType: binance?.authType },
    openai: { connected: !!openai, checkedAt: openai?.checkedAt, model: openai?.model || 'gpt-5-mini' },
    maxOrderUsdt: '100',
  };
}
