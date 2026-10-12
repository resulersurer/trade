// Separate read-only D1 health Worker; no public write paths, no Binance orders.
export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    const headers = { 'cache-control': 'no-store', 'content-type': 'application/json' };
    if (request.method !== 'GET' || u.pathname !== '/health') {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }
    try {
      const result = await env.PAPER_DB.prepare(
        'SELECT COUNT(*) AS n FROM sqlite_master WHERE type=? AND name IN (?,?,?)'
      ).bind('table', 'paper_signals', 'paper_positions', 'paper_events').first();
      const ready = result?.n === 3;
      return new Response(JSON.stringify({
        status: ready ? 'ok' : 'degraded', database: 'D1', schemaReady: ready
      }), { status: ready ? 200 : 503, headers });
    } catch {
      return new Response(JSON.stringify({ status: 'unavailable' }), { status: 503, headers });
    }
  }
};
