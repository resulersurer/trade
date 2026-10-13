import { futuresContext, signedRequest } from '@/lib/binance';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/db';
import { AppError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request) {
  try {
    const session = await getSession();
    const symbol = new URL(request.url).searchParams.get('symbol') || 'BTCUSDT';
    if (!/^[A-Z0-9]{5,24}$/.test(symbol)) throw new AppError('Parite geçersiz.');
    await rateLimit(`account:${session.id}`, 120, 3600);
    const [account, context] = await Promise.all([
      signedRequest(session.credentials.binance, 'GET', '/fapi/v3/account'),
      futuresContext(session.credentials.binance, symbol),
    ]);
    const usdt = account.assets.find(a => a.asset === 'USDT');
    return Response.json({ symbol, availableBalance: usdt?.availableBalance || '0', walletBalance: usdt?.walletBalance || '0',
      leverage: context.config.leverage, marginType: context.config.marginType,
      positionMode: context.config.dualSidePosition ? 'HEDGE' : 'ONE_WAY',
      positions: context.positions.filter(p => Number(p.positionAmt) !== 0).map(p => ({
        symbol: p.symbol, positionSide: p.positionSide, quantity: p.positionAmt, entryPrice: p.entryPrice,
        markPrice: p.markPrice, unrealizedProfit: p.unRealizedProfit, liquidationPrice: p.liquidationPrice,
      })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
