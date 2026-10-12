import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function encryptionKey() {
  const value = process.env.VAULT_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new AppError('Güvenli kasa henüz yapılandırılmadı.', 503);
  }
  return Buffer.from(value, 'hex');
}

export function seal(value, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64url')).join('.');
}

export function unseal(value, context) {
  const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}

export const hash = value => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export function sameOrigin(request) {
  const expected = new URL(request.url).origin;
  if (request.headers.get('origin') !== expected) {
    throw new AppError('İstek kaynağı doğrulanamadı. Sayfayı yenileyin.', 403);
  }
}

export async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new AppError('JSON içerik gerekli.', 415);
  }
  // Bound the streamed body as well as Content-Length (which may be absent).
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('İstek gövdesi eksik.');
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new AppError('İstek çok büyük.', 413); }
    chunks.push(Buffer.from(value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError('Geçersiz JSON.'); }
}
