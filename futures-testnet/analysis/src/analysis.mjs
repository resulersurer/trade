import { getClosedCandles } from '../../src/futures-testnet.mjs';
const API = 'https://api.openai.com/v1/responses';
const SIGNALS = new Set(['LONG', 'SHORT', 'WAIT']);
export function validateDecision(raw) {
  if (!raw || typeof raw !== 'object' || !SIGNALS.has(raw.signal) || typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 100 || typeof raw.reason !== 'string' || raw.reason.length > 600) throw new Error('Invalid AI decision');
  return { signal: raw.signal, confidence: raw.confidence, reason: raw.reason, canSubmitOrder: false };
}
export async function analyzeFutures({ symbol = 'BTCUSDT', apiKey, fetchMarket = getClosedCandles, fetchImpl = fetch, model = 'gpt-5-mini', now = Date.now() } = {}) {
  if (!apiKey || typeof apiKey !== 'string') throw new Error('OPENAI_API_KEY is required');
  if (!/^gpt-[a-zA-Z0-9.-]+$/.test(model)) throw new Error('Invalid model');
  const [fast, slow] = await Promise.all([fetchMarket({ symbol, interval: '5m', limit: 100, now }), fetchMarket({ symbol, interval: '15m', limit: 100, now })]);
  if (fast.length < 30 || slow.length < 30) throw new Error('Insufficient closed candles');
  const snapshot = { symbol, asOf: new Date(now).toISOString(), candles5m: fast.slice(-60), candles15m: slow.slice(-60) };
  const schema = { type: 'object', properties: { signal: { type: 'string', enum: ['LONG','SHORT','WAIT'] }, confidence: { type: 'number' }, reason: { type: 'string' } }, required: ['signal','confidence','reason'], additionalProperties: false };
  const res = await fetchImpl(API, { method: 'POST', headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ model, store: false, instructions: 'You are an advisory-only Binance Futures demo market analyst. Analyze only supplied completed 5m and 15m candles; output LONG, SHORT, or WAIT. Never authorize or place orders. Prefer WAIT if uncertain.', input: JSON.stringify(snapshot), text: { format: { type: 'json_schema', name: 'futures_advisory', strict: true, schema } }, max_output_tokens: 250 }) });
  if (!res.ok) throw new Error('OpenAI request failed (' + res.status + ')');
  const json = await res.json();
  const output = (json.output || []).flatMap(item => item.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
  if (!output) throw new Error('No structured analysis returned');
  const decision = validateDecision(JSON.parse(output));
  return { ...decision, symbol, analyzedAt: snapshot.asOf, candles: { '5m': fast.length, '15m': slow.length }, mode: 'ADVISORY_ONLY' };
}
