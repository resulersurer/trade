import { ensureSession, publicSession } from '@/lib/session';
import { AppError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export async function GET(request) {
  try { return Response.json(publicSession(await ensureSession(request)), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return Response.json({ error: error.message }, { status: error instanceof AppError ? error.status : 500 }); }
}
