import { verifyBinance } from '@/lib/binance';
import { rsaSignature } from '@/lib/futures.mjs';
import { rateLimit } from '@/lib/db';
import { getSession, publicSession, saveCredentials } from '@/lib/session';
import { AppError, body, sameOrigin } from '@/lib/security';

export async function POST(request) {
  try {
    sameOrigin(request);
    const input = await body(request);
    const session = await getSession();
    const credentials = { ...session.credentials };
    if (input.provider === 'binance') {
      await rateLimit(`integrations:${session.id}`, 10, 3600);
      if (!/^[-_A-Za-z0-9]{20,128}$/.test(String(input.apiKey || '').trim())) throw new AppError('Binance API Key biçimi geçersiz.');
      const privateKey = process.env.BINANCE_RSA_PRIVATE_KEY;
      if (!privateKey) throw new AppError('RSA private key sunucuda henüz yapılandırılmadı.', 503);
      try { rsaSignature('key-validation', privateKey); } catch { throw new AppError('Sunucudaki RSA anahtarı geçersiz.', 503); }
      const binance = { apiKey: input.apiKey.trim(), privateKey, authType: 'RSA', marketType: 'USDS_FUTURES' };
      const checked = await verifyBinance(binance);
      credentials.binance = { ...binance, ...checked, checkedAt: new Date().toISOString() };
    } else if (input.provider === 'openai') {
      if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(input.apiKey || '')) throw new AppError('OpenAI anahtar biçimi geçersiz.');
      const response = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${input.apiKey.trim()}` }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new AppError('OpenAI anahtarı doğrulanamadı.', 401);
      credentials.openai = { apiKey: input.apiKey.trim(), model: 'gpt-5-mini', checkedAt: new Date().toISOString() };
    } else throw new AppError('Bilinmeyen eklenti.');
    await saveCredentials(session, credentials);
    return Response.json(publicSession({ ...session, credentials, version: session.version + 1 }));
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}

export async function DELETE(request) {
  try {
    sameOrigin(request);
    const input = await body(request); const session = await getSession();
    if (!['binance', 'openai'].includes(input.provider)) throw new AppError('Bilinmeyen eklenti.');
    const credentials = { ...session.credentials }; delete credentials[input.provider];
    await saveCredentials(session, credentials);
    return Response.json(publicSession({ ...session, credentials, version: session.version + 1 }));
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
