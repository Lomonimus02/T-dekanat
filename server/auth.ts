import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { one, q } from './db.js';
import { hashToken, randomToken } from './lib/crypto.js';

export const COOKIE = 'sd_sid';

export type SessionUser = { id: string; role: 'student' | 'staff'; login: string; sessionId: number; name: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: SessionUser } }
}

// Пустой хэш для выравнивания времени ответа, когда логина нет (защита от перебора логинов по таймингу)
const DUMMY_HASH = bcrypt.hashSync('timing-dummy', 11);

export async function verifyLogin(login: string, password: string) {
  const u = await one<{ id: string; password_hash: string; role: string }>('SELECT id, password_hash, role FROM users WHERE login = $1', [login]);
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);
  return ok && u ? u : null;
}

export async function tooManyAttempts(login: string, ip: string) {
  const r = await one<{ by_ip: number; by_login: number }>(
    `SELECT count(*) FILTER (WHERE ip = $2) AS by_ip, count(*) FILTER (WHERE login = $1) AS by_login
       FROM login_attempts WHERE NOT ok AND at > now() - interval '15 minutes'`, [login, ip]);
  return (r?.by_ip ?? 0) >= 20 || (r?.by_login ?? 0) >= 8;
}

export async function createSession(res: Response, userId: string, req: Request) {
  const token = randomToken();
  await q(`INSERT INTO sessions(token_hash,user_id,expires_at,user_agent,ip) VALUES ($1,$2, now() + ($3 || ' days')::interval, $4, $5)`,
    [hashToken(token), userId, String(config.sessionDays), (req.get('user-agent') ?? '').slice(0, 300), req.ip]);
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: config.basePath || '/', maxAge: config.sessionDays * 86_400_000,
  });
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (typeof token === 'string' && token.length > 20) {
    const s = await one<{ sid: number; id: string; role: 'student' | 'staff'; login: string; name: string }>(
      `UPDATE sessions s SET last_seen = now() FROM users u
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.id = s.user_id
        RETURNING s.id AS sid, u.id, u.role, u.login, u.last_name || ' ' || u.first_name AS name`, [hashToken(token)]);
    if (s) req.user = { id: s.id, role: s.role, login: s.login, sessionId: s.sid, name: s.name };
  }
  next();
}

export function requireAuth(role?: 'student' | 'staff') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Нужно войти' });
    if (role && req.user.role !== role) return res.status(403).json({ error: 'Нет доступа' });
    next();
  };
}

/** CSRF: изменяющие запросы принимаются только с нашим заголовком и с нашего Origin */
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'stellar') return res.status(403).json({ error: 'Запрос отклонён (CSRF)' });
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Запрос отклонён (Origin)' });
    } catch { return res.status(403).json({ error: 'Запрос отклонён' }); }
  }
  next();
}

export async function audit(userId: string | null, action: string, target: string | null, ip?: string) {
  await q('INSERT INTO audit_log(user_id,action,target,ip) VALUES ($1,$2,$3,$4)', [userId, action, target, ip ?? null]);
}
