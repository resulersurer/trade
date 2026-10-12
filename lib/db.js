import 'server-only';
import { neon } from '@neondatabase/serverless';
import { AppError } from './security';

export function db() {
  if (!process.env.DATABASE_URL) throw new AppError('Veritabanı kurulumu bekleniyor. Anahtarlar henüz kaydedilemez.', 503);
  return neon(process.env.DATABASE_URL);
}

export async function rateLimit(key, limit, seconds = 60) {
  const sql = db();
  const window = Math.floor(Date.now() / (seconds * 1000));
  const [row] = await sql`
    INSERT INTO rate_limits (key, window, count) VALUES (${key}, ${window}, 1)
    ON CONFLICT (key) DO UPDATE SET window = EXCLUDED.window,
      count = CASE WHEN rate_limits.window = EXCLUDED.window THEN rate_limits.count + 1 ELSE 1 END
    RETURNING count`;
  if (row.count > limit) throw new AppError('Çok fazla istek. Lütfen biraz bekleyin.', 429);
}
