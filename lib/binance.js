import 'server-only';
import { createHmac } from 'node:crypto';
import Decimal from 'decimal.js';
import { AppError } from './security';

const base = 'https://api.binance.com';

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AppError(data.msg || `Binance isteği başarısız (${response.status}).`, response.status === 401 ? 401 : 400);
  return data;
}

export async function publicRequest(path, params = {}) {
  const query = new URLSearchParams(params);
  return parse(await fetch(`${base}${path}?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(9000) }));
}

export async function signedRequest(credentials, method, path, params = {}) {
  const server = await publicRequest('/api/v3/time');
  const query = new URLSearchParams({ ...params, recvWindow: '5000', timestamp: String(server.serverTime) });
  query.set('signature', createHmac('sha256', credentials.secretKey).update(query.toString()).digest('hex'));
  return parse(await fetch(`${base}${path}?${query}`, {
    method,
    headers: { 'X-MBX-APIKEY': credentials.apiKey },
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  }));
}

export async function verifyBinance(credentials) {
  const account = await signedRequest(credentials, 'GET', '/api/v3/account', { omitZeroBalances: 'true' });
  if (account.canTrade !== true) throw new AppError('Bu Binance hesabında spot işlem yetkisi etkin değil.', 403);
  return { canTrade: account.canTrade === true, accountType: account.accountType || 'SPOT' };
}

function floorTo(value, step) {
  return new Decimal(value).div(step).floor().mul(step).toFixed(new Decimal(step).decimalPlaces());
}

export async function normalizeOrder(input) {
  const symbol = String(input.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const side = input.side === 'SELL' ? 'SELL' : input.side === 'BUY' ? 'BUY' : '';
  const amount = new Decimal(String(input.amount || '0'));
  if (!symbol || !side || !amount.isFinite() || amount.lte(0)) throw new AppError('Parite, yön veya tutar geçersiz.');
  const info = await publicRequest('/api/v3/exchangeInfo', { symbol });
  const market = info.symbols?.[0];
  if (!market || market.status !== 'TRADING' || !market.isSpotTradingAllowed) throw new AppError('Bu parite spot işlemlere açık değil.');
  const price = new Decimal((await publicRequest('/api/v3/ticker/price', { symbol })).price);
  const lot = market.filters.find(filter => filter.filterType === 'LOT_SIZE');
  const minNotional = market.filters.find(filter => filter.filterType === 'NOTIONAL' || filter.filterType === 'MIN_NOTIONAL');
  const params = { symbol, side, type: 'MARKET', newOrderRespType: 'FULL' };
  let estimatedQuote;
  if (side === 'BUY') {
    if (!market.quoteOrderQtyMarketAllowed) throw new AppError('Bu paritede tutarla piyasa alımı desteklenmiyor.');
    params.quoteOrderQty = amount.toFixed(Math.min(market.quoteAssetPrecision || 8, 8));
    estimatedQuote = amount;
  } else {
    params.quantity = floorTo(amount, lot.stepSize);
    if (new Decimal(params.quantity).lt(lot.minQty)) throw new AppError(`Minimum satış miktarı ${lot.minQty} ${market.baseAsset}.`);
    estimatedQuote = new Decimal(params.quantity).mul(price);
  }
  const minimum = new Decimal(minNotional?.minNotional || minNotional?.notional || 0);
  if (estimatedQuote.lt(minimum)) throw new AppError(`Tahmini emir değeri en az ${minimum} ${market.quoteAsset} olmalı.`);
  if (market.quoteAsset !== 'USDT') throw new AppError('İlk sürümde yalnızca USDT pariteleri destekleniyor.');
  if (estimatedQuote.gt(100)) throw new AppError('Tek emir güvenlik limiti 100 USDT.');
  return { params, market, price: price.toString(), estimatedQuote: estimatedQuote.toFixed(2) };
}
