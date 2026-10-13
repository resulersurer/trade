import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { publicRequest } from '@/lib/binance';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/db';
import { AppError, body, sameOrigin } from '@/lib/security';

const schema = z.object({ verdict: z.enum(['AL', 'BEKLE', 'SAT']), confidence: z.number().min(0).max(100),
  summary: z.string().max(500), risks: z.array(z.string().max(200)).max(4), levels: z.object({ support: z.string(), resistance: z.string() }) });

export async function POST(request) {
  try {
    sameOrigin(request); const input = await body(request); const session = await getSession();
    if (!session.credentials.openai) throw new AppError('Önce OpenAI eklentisini bağlayın.', 409);
    await rateLimit(`analysis:${session.id}`, 10, 3600);
    const symbol = String(input.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const candles = await publicRequest('/fapi/v1/klines', { symbol, interval: '1h', limit: '48' });
    const compact = candles.map(c => ({ t: c[0], o: c[1], h: c[2], l: c[3], c: c[4], v: c[5] }));
    const provider = createOpenAI({ apiKey: session.credentials.openai.apiKey });
    const result = await generateText({ model: provider(session.credentials.openai.model), output: Output.object({ schema }), maxOutputTokens: 700,
      providerOptions: { openai: { store: false } },
      system: 'Sen ihtiyatlı bir piyasa analiz aracısın. Emir vermezsin. Kesin kazanç iddiasında bulunmazsın. Yalnızca verilen mum verisini teknik açıdan değerlendir ve Türkçe yanıtla.',
      prompt: `${symbol} için son 48 adet 1 saatlik mum: ${JSON.stringify(compact)}` });
    return Response.json({ ...result.output, generatedAt: new Date().toISOString() });
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
