import crypto from 'node:crypto';
import { config } from '../config.js';

const key = Buffer.from(config.dataKey, 'hex');
if (key.length !== 32) throw new Error('DATA_KEY должен быть 32 байта в hex (openssl rand -hex 32)');

/** AES-256-GCM: iv.tag.ciphertext (base64url). Для персональных полей: зачётка, телефон, почта. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(packed: string | null | undefined): string | null {
  if (!packed) return null;
  const [iv, tag, enc] = packed.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** В БД хранится только HMAC от токена сессии: утечка таблицы не даёт войти. */
export function hashToken(token: string) {
  return crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');
}
