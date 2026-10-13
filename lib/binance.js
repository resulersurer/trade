import 'server-only';
import { AppError } from './security.js';
import { buildFuturesOrder, FUTURES_BASE, rsaSignature } from './futures.mjs';

async function parse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || (typeof data.code === 'number' && data.code < 0)) {
    const error = new AppError(data?.msg || `Binance isteği başarısız (${response.status}).`, response.status === 429 ? 429 : 400);
    error.executionUnknown = response.status >= 500 || response.status === 408 || !data || [-1006, -1007].includes(data?.code);
    error.definitiveRejection = !error.executionUnknown;
    throw error;
  }
  return data;
}
export async function publicRequest(path, params = {}) {
  const query = new URLSearchParams(params);
  return parse(await fetch(`${FUTURES_BASE}${path}?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(9000) }));
}
export function requireFutures(credentials) {
  if (credentials?.marketType !== 'USDS_FUTURES' || credentials?.authType !== 'RSA') throw new AppError('Binance Futures RSA bağlantısını Eklentiler ekranından ekleyin.', 409);
}
export async function signedRequest(credentials, method, path, params = {}) {
  requireFutures(credentials);
  const server = await publicRequest('/fapi/v1/time');
  const query = new URLSearchParams({ ...params, recvWindow: '5000', timestamp: String(server.serverTime) });
  query.set('signature', rsaSignature(query.toString(), credentials.privateKey));
  return parse(await fetch(`${FUTURES_BASE}${path}?${query}`, { method, headers: { 'X-MBX-APIKEY': credentials.apiKey }, cache: 'no-store', signal: AbortSignal.timeout(10000) }));
}
export async function verifyBinance(credentials) {
  const config = await signedRequest(credentials, 'GET', '/fapi/v1/accountConfig');
  if (config.canTrade !== true) throw new AppError('Bu Binance hesabında Futures işlem yetkisi etkin değil.', 403);
  await signedRequest(credentials, 'GET', '/fapi/v3/account');
  return { canTrade: true, accountType: 'USDS_FUTURES' };
}
export async function futuresContext(credentials, symbol) {
  const [accountConfig, symbols, positions] = await Promise.all([
    signedRequest(credentials, 'GET', '/fapi/v1/accountConfig'),
    signedRequest(credentials, 'GET', '/fapi/v1/symbolConfig', { symbol }),
    signedRequest(credentials, 'GET', '/fapi/v3/positionRisk', { symbol }),
  ]);
  const symbolConfig = symbols.find(p => p.symbol === symbol);
  if (!accountConfig.canTrade || !symbolConfig) throw new AppError('Futures hesap ayarları alınamadı.', 403);
  return { config: { ...symbolConfig, dualSidePosition: accountConfig.dualSidePosition }, positions };
}
export async function normalizeOrder(input, credentials, approvedQuantity = null) {
  requireFutures(credentials);
  const symbol = String(input.symbol || '');
  if (!/^[A-Z0-9]{5,24}$/.test(symbol)) throw new AppError('Parite geçersiz.');
  const [info, ticker, context, openOrders, algoOrders] = await Promise.all([
    publicRequest('/fapi/v1/exchangeInfo'), publicRequest('/fapi/v1/ticker/price', { symbol }),
    futuresContext(credentials, symbol),
    signedRequest(credentials, 'GET', '/fapi/v1/openOrders', { symbol }),
    signedRequest(credentials, 'GET', '/fapi/v1/openAlgoOrders', { symbol }),
  ]);
  try { return buildFuturesOrder(input, info.symbols.find(p => p.symbol === symbol), ticker.price, context.config, context.positions, [...openOrders, ...algoOrders], approvedQuantity); }
  catch (error) { throw new AppError(error.message); }
}
