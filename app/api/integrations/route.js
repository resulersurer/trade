import { verifyBinance } from '@/lib/binance';
import { getSession, publicSession, saveCredentials } from '@/lib/session';
import { AppError, body, sameOrigin } from '@/lib/security';

export async function POST(request) {
  try {
    sameOrigin(request);
    const input = await body(request);
    const session = await getSession();
    const credentials = { ...session.credentials };
    if (input.provider === 'binance') {
      if (!/^[-_A-Za-z0-9]{20,128}$/.test(input.apiKey || '') || !/^[-_A-Za-z0-9]{20,128}$/.test(input.secretKey || '')) throw new AppError('Binance anahtar biçimi geçersiz.');
      const checked = await verifyBinance({ apiKey: input.apiKey.trim(), secretKey: input.secretKey.trim() });
      credentials.binance = { apiKey: input.apiKey.trim(), secretKey: input.secretKey.trim(), ...checked, checkedAt: new Date().toISOString() };
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
