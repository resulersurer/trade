import { createPrivateKey, sign } from 'node:crypto';
import Decimal from 'decimal.js';

export const FUTURES_BASE = 'https://fapi.binance.com';
export function rsaSignature(payload, pem) {
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) throw new Error('En az 2048 bit RSA private key gerekli.');
  return sign('RSA-SHA256', Buffer.from(payload), key).toString('base64');
}

export function buildFuturesOrder(input, market, priceValue, config, positions, openOrders = [], approvedQuantity = null) {
  const fail = message => { throw new Error(message); };
  if (!['LONG', 'SHORT'].includes(input.direction) || !['OPEN', 'CLOSE'].includes(input.action)) fail('Pozisyon yönü veya işlem geçersiz.');
  if (!market || market.status !== 'TRADING' || market.contractType !== 'PERPETUAL' || market.quoteAsset !== 'USDT' || market.marginAsset !== 'USDT') fail('Yalnızca USDT teminatlı sürekli Futures sözleşmeleri destekleniyor.');
  let amount;
  try { amount = new Decimal(String(input.amount)); } catch { fail('Tutar geçersiz.'); }
  if (!amount.isFinite() || amount.lte(0) || amount.gt(100)) fail('Emir değeri 0 ile 100 USDT arasında olmalı.');
  const price = new Decimal(priceValue);
  if (!price.isFinite() || price.lte(0)) fail('Piyasa fiyatı alınamadı.');
  const lot = market.filters.find(f => f.filterType === 'LOT_SIZE');
  const marketLot = market.filters.find(f => f.filterType === 'MARKET_LOT_SIZE');
  if (!lot || new Decimal(lot.stepSize).lte(0)) fail('Miktar kuralları alınamadı.');
  const step = Decimal.max(lot.stepSize, marketLot?.stepSize || 0);
  const quantity = approvedQuantity === null ? amount.div(price).div(step).floor().mul(step) : new Decimal(approvedQuantity);
  if (!quantity.isFinite() || !quantity.mod(lot.stepSize).eq(0) || (new Decimal(marketLot?.stepSize || 0).gt(0) && !quantity.mod(marketLot.stepSize).eq(0))) fail('Miktar sözleşmenin adım kuralına uymuyor.');
  const minQty = Decimal.max(lot.minQty, marketLot?.minQty || 0);
  const maxQty = Decimal.min(lot.maxQty, new Decimal(marketLot?.maxQty || 0).gt(0) ? marketLot.maxQty : lot.maxQty);
  if (quantity.lt(minQty) || quantity.gt(maxQty) || quantity.lte(0)) fail(`Emir miktarı ${minQty} ile ${maxQty} ${market.baseAsset} arasında olmalı.`);
  const notional = quantity.mul(price);
  if (notional.gt(100)) fail('Güncel emir değeri 100 USDT limitini aşıyor. Yeni önizleme oluşturun.');
  const closing = input.action === 'CLOSE';
  const hedge = config.dualSidePosition;
  if (typeof hedge !== 'boolean' || !Number.isInteger(Number(config.leverage)) || Number(config.leverage) < 1 || !['ISOLATED', 'CROSSED'].includes(config.marginType)) fail('Hesap işlem ayarları doğrulanamadı.');
  const side = (input.direction === 'LONG') !== closing ? 'BUY' : 'SELL';
  const positionSide = hedge ? input.direction : 'BOTH';
  const position = positions.find(p => p.symbol === market.symbol && p.positionSide === positionSide);
  const positionAmount = new Decimal(position?.positionAmt || 0);
  if (closing) {
    const matching = input.direction === 'LONG' ? positionAmount.gt(0) : positionAmount.lt(0);
    if (!matching || quantity.gt(positionAmount.abs())) fail('Kapatma miktarı mevcut pozisyonu aşıyor veya seçilen yönde pozisyon yok.');
  } else {
    if (!hedge && ((input.direction === 'LONG' && positionAmount.lt(0)) || (input.direction === 'SHORT' && positionAmount.gt(0)))) fail('Önce ters yöndeki mevcut pozisyonu kapatın.');
    if (openOrders.length) fail('Bu paritede bekleyen emirler var. Yeni pozisyon açmadan önce Binance üzerinden kontrol edin.');
    const minimum = market.filters.find(f => f.filterType === 'MIN_NOTIONAL');
    if (notional.lt(minimum?.notional || 0)) fail(`Emir değeri en az ${minimum.notional} USDT olmalı.`);
  }
  const params = { symbol: market.symbol, side, positionSide, type: 'MARKET', quantity: quantity.toFixed(step.decimalPlaces()), newOrderRespType: 'RESULT' };
  if (closing && !hedge) params.reduceOnly = 'true';
  return { params, market, price: price.toString(), estimatedQuote: notional.toFixed(2), metadata: { marketType: 'USDS_FUTURES', action: input.action, direction: input.direction, positionMode: hedge ? 'HEDGE' : 'ONE_WAY', leverage: Number(config.leverage), marginType: config.marginType } };
}

export function uncertainExecution(error) {
  return error.executionUnknown === true || error.name === 'TimeoutError' || error.name === 'AbortError' || /timeout|unknown|fetch failed|network|socket|ECONN/i.test(error.message);
}
