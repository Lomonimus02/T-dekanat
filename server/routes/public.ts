import { Router } from 'express';
import { z } from 'zod';
import { COOKIE, audit, createSession, tooManyAttempts, verifyLogin } from '../auth.js';
import { config } from '../config.js';
import { one, q } from '../db.js';

export const pub = Router();

const loginSchema = z.object({ login: z.string().trim().min(1).max(64), password: z.string().min(1).max(128) });

pub.post('/auth/login', async (req, res) => {
  const p = loginSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Введите логин и пароль' });
  const login = p.data.login.toLowerCase();
  const ip = req.ip ?? '';
  if (await tooManyAttempts(login, ip)) return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
  const u = await verifyLogin(login, p.data.password);
  await q('INSERT INTO login_attempts(login, ip, ok) VALUES ($1,$2,$3)', [login, ip, !!u]);
  if (!u) return res.status(401).json({ error: 'Неверный логин или пароль' });
  await createSession(res, u.id, req);
  await audit(u.id, 'login', null, ip);
  res.json({ role: u.role });
});

pub.post('/auth/logout', async (req, res) => {
  if (req.user) {
    await q('DELETE FROM sessions WHERE id = $1', [req.user.sessionId]);
    await audit(req.user.id, 'logout', null, req.ip);
  }
  res.clearCookie(COOKIE, { path: config.basePath || '/' });
  res.json({ ok: true });
});

pub.get('/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Нужно войти' });
  res.json({ id: req.user.id, role: req.user.role, name: req.user.name, login: req.user.login });
});

// Публичная проверка подлинности справки по QR: только факт и минимум данных
pub.get('/verify/:code', async (req, res) => {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(req.params.code)) return res.status(404).json({ valid: false });
  const r = await one(`SELECT r.number, r.title, r.status, r.updated_at, u.last_name, left(u.first_name,1) AS fi, left(coalesce(u.middle_name,''),1) AS mi
                         FROM requests r JOIN users u ON u.id = r.student_id WHERE r.verify_code = $1 AND r.status IN ('ready','done')`, [req.params.code]);
  if (!r) return res.status(404).json({ valid: false });
  res.json({ valid: true, number: r.number, title: r.title, holder: `${r.last_name} ${r.fi}. ${r.mi}.`, issuedAt: r.updated_at });
});

pub.get('/health', (_req, res) => res.json({ ok: true }));
