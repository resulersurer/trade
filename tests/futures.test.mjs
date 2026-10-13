import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { buildFuturesOrder, rsaSignature, uncertainExecution } from '../lib/futures.mjs';

const market = { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', marginAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL', quantityPrecision: 8, filters: [
  { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '100' },
  { filterType: 'MARKET_LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '20' },
  { filterType: 'MIN_NOTIONAL', notional: '5' },
] };
const config = { dualSidePosition: false, leverage: 20, marginType: 'ISOLATED' };
const input = { direction: 'LONG', action: 'OPEN', amount: '25' };
const make = (i = {}, c = {}, positions = [], orders = [], qty = null, price = '2000') => buildFuturesOrder({ ...input, ...i }, market, price, { ...config, ...c }, positions, orders, qty);
const position = (value, side = 'BOTH') => ({ symbol: 'ETHUSDT', positionSide: side, positionAmt: value });

test('RSA signature validates and survives URL encoding of base64', () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const payload = 'symbol=ETHUSDT&side=BUY&timestamp=123';
  const signature = rsaSignature(payload, keys.privateKey);
  const query = new URLSearchParams({ signature });
  assert.ok(verify('RSA-SHA256', Buffer.from(payload), keys.publicKey, Buffer.from(query.get('signature'), 'base64')));
  assert.equal(verify('RSA-SHA256', Buffer.from(payload + '4'), keys.publicKey, Buffer.from(signature, 'base64')), false);
});
test('non-RSA keys are rejected', () => {
  const key = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.throws(() => rsaSignature('payload', key), /RSA/);
});
test('USDT input is not multiplied by leverage and quantity rounds down to filter', () => {
  const result = make();
  assert.equal(result.params.quantity, '0.012');
  assert.equal(result.estimatedQuote, '24.00');
  assert.equal(result.params.side, 'BUY');
  assert.equal(result.params.positionSide, 'BOTH');
});
test('one-way short opens with SELL', () => assert.equal(make({ direction: 'SHORT' }).params.side, 'SELL'));
test('one-way close is reduce-only and uses opposite side', () => {
  const result = make({ action: 'CLOSE' }, {}, [position('0.1')]);
  assert.equal(result.params.side, 'SELL');
  assert.equal(result.params.reduceOnly, 'true');
  assert.equal(make({ action: 'CLOSE', direction: 'SHORT' }, {}, [position('-0.1')]).params.side, 'BUY');
});
test('hedge orders require explicit position side and omit reduceOnly', () => {
  assert.equal(make({}, { dualSidePosition: true }).params.positionSide, 'LONG');
  const result = make({ action: 'CLOSE', direction: 'SHORT' }, { dualSidePosition: true }, [position('-0.1', 'SHORT')]);
  assert.equal(result.params.side, 'BUY');
  assert.equal(result.params.positionSide, 'SHORT');
  assert.equal(result.params.reduceOnly, undefined);
});
test('closing cannot reverse position, exceed quantity, or close wrong direction', () => {
  assert.throws(() => make({ action: 'CLOSE' }, {}, []), /pozisyon/);
  assert.throws(() => make({ action: 'CLOSE' }, {}, [position('0.001')]), /pozisyon/);
  assert.throws(() => make({ action: 'CLOSE', direction: 'SHORT' }, {}, [position('0.1')]), /pozisyon/);
});
test('one-way opening cannot net out an opposite position', () => assert.throws(() => make({}, {}, [position('-0.1')]), /ters/));
test('pending standard or conditional orders block opening', () => assert.throws(() => make({}, {}, [], [{ orderId: 1 }]), /bekleyen/));
test('opening enforces minimum notional; reduce-only closing permits smaller amount', () => {
  assert.throws(() => make({ amount: '2' }), /en az/);
  assert.equal(make({ action: 'CLOSE', amount: '2' }, {}, [position('0.001')]).params.quantity, '0.001');
});
test('invalid inputs and values over 100 USDT are rejected', () => {
  for (const amount of ['NaN', 'Infinity', '-1', '0', '101', 'nonsense']) assert.throws(() => make({ amount }));
  assert.throws(() => make({ direction: 'BUY' }));
});
test('approved quantity stays unchanged despite price changes', () => {
  assert.equal(make({}, {}, [], [], '0.012', '2100').params.quantity, '0.012');
  assert.throws(() => make({}, {}, [], [], '0.050', '2100'), /100 USDT/);
  assert.throws(() => make({}, {}, [], [], '0.0125'), /adım/);
});
test('missing account settings prevent trading', () => assert.throws(() => make({}, { dualSidePosition: undefined }), /ayarları/));
test('network failures and Binance unknown responses block retry', () => {
  for (const error of [new Error('fetch failed'), new Error('socket closed'), { name: 'AbortError', message: '' }, { executionUnknown: true, message: '503' }]) assert.equal(uncertainExecution(error), true);
  assert.equal(uncertainExecution(new Error('Insufficient balance')), false);
});
