import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { signedRequest, publicRequest, verifyBinance, normalizeOrder } from '../lib/binance.js';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const credentials = { apiKey: 'test-key', privateKey: keys.privateKey, authType: 'RSA', marketType: 'USDS_FUTURES' };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('signed Futures request uses RSA, correct host and server timestamp', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url); calls.push(parsed.pathname);
    assert.equal(parsed.origin, 'https://fapi.binance.com');
    if (parsed.pathname === '/fapi/v1/time') return response({ serverTime: 123456 });
    assert.equal(options.method, 'GET');
    assert.equal(options.headers['X-MBX-APIKEY'], 'test-key');
    assert.equal(parsed.searchParams.get('timestamp'), '123456');
    const signature = parsed.searchParams.get('signature'); parsed.searchParams.delete('signature');
    assert.ok(verify('RSA-SHA256', Buffer.from(parsed.searchParams.toString()), keys.publicKey, Buffer.from(signature, 'base64')));
    return response({ canTrade: true });
  });
  await signedRequest(credentials, 'GET', '/fapi/v1/accountConfig');
  assert.deepEqual(calls, ['/fapi/v1/time', '/fapi/v1/accountConfig']);
});
test('legacy Spot credentials never send a Futures request', async t => {
  let called = false;
  t.mock.method(globalThis, 'fetch', async () => { called = true; });
  await assert.rejects(signedRequest({ apiKey: 'old', secretKey: 'old' }, 'POST', '/fapi/v1/order'), /RSA bağlantısını/);
  assert.equal(called, false);
});
test('connection verification sends only read-only account requests', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname; calls.push(path);
    if (path === '/fapi/v1/time') return response({ serverTime: 123 });
    assert.equal(options.method, 'GET');
    return response({ canTrade: true });
  });
  assert.equal((await verifyBinance(credentials)).canTrade, true);
  assert.equal(calls.some(path => path.includes('/order')), false);
});
test('HTTP 503 and Binance timeout codes are uncertain; validation rejection is definitive', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ msg: 'Unknown error', code: -1007 }, 503));
  await assert.rejects(publicRequest('/fapi/v1/ticker/price'), e => e.executionUnknown === true && e.definitiveRejection === false);
  globalThis.fetch = async () => response({ msg: 'Insufficient margin', code: -2019 }, 400);
  await assert.rejects(publicRequest('/fapi/v1/ticker/price'), e => e.executionUnknown === false && e.definitiveRejection === true);
});
test('normalization reads account and contract filters without any trading mutation', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/fapi/v1/time') return response({ serverTime: 123 });
    assert.ok(!options.method || options.method === 'GET');
    if (path === '/fapi/v1/exchangeInfo') return response({ symbols: [{ symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', marginAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING', filters: [{ filterType: 'LOT_SIZE', minQty: '0.001', maxQty: '10', stepSize: '0.001' }, { filterType: 'MIN_NOTIONAL', notional: '5' }] }] });
    if (path === '/fapi/v1/ticker/price') return response({ price: '2000' });
    if (path === '/fapi/v1/accountConfig') return response({ canTrade: true, dualSidePosition: true });
    if (path === '/fapi/v1/symbolConfig') return response([{ symbol: 'ETHUSDT', leverage: 10, marginType: 'ISOLATED' }]);
    if (['/fapi/v3/positionRisk', '/fapi/v1/openOrders', '/fapi/v1/openAlgoOrders'].includes(path)) return response([]);
    throw new Error(`Unexpected endpoint: ${path}`);
  });
  const normalized = await normalizeOrder({ symbol: 'ETHUSDT', direction: 'SHORT', action: 'OPEN', amount: '25' }, credentials);
  assert.equal(normalized.params.side, 'SELL');
  assert.equal(normalized.params.positionSide, 'SHORT');
  assert.equal(normalized.params.quantity, '0.012');
});
