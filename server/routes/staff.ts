import { Router } from 'express';
import { z } from 'zod';
import { audit, requireAuth } from '../auth.js';
import { one, q, tx } from '../db.js';
import { randomToken } from '../lib/crypto.js';
import { ALLOWED_TRANSITIONS, STATUS_LABEL, typeById, type Status } from '../../shared/requests.js';

export const staff = Router();
staff.use(requireAuth('staff'));

staff.get('/staff/me', async (req, res) => {
  const s = await one(`SELECT u.last_name, u.first_name, u.middle_name, st.position FROM users u JOIN staff st ON st.user_id = u.id WHERE u.id = $1`, [req.user!.id]);
  res.json(s);
});

staff.get('/staff/stats', async (_req, res) => {
  const rows = await q(`SELECT status, count(*)::int AS n FROM requests GROUP BY status`);
  const overdue = await one(`SELECT count(*)::int AS n FROM requests WHERE status IN ('submitted','review','preparing') AND due_at < now()`);
  const today = await one(`SELECT count(*)::int AS n FROM requests WHERE created_at::date = current_date`);
  res.json({ byStatus: Object.fromEntries(rows.map((r) => [r.status, r.n])), overdue: overdue?.n ?? 0, today: today?.n ?? 0 });
});

staff.get('/staff/requests', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'active';
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (status === 'active') where.push(`r.status IN ('submitted','review','preparing','needs_info')`);
  else if (status !== 'all' && status in STATUS_LABEL) { params.push(status); where.push(`r.status = $${params.length}`); }
  if (search) { params.push(`%${search.toLowerCase()}%`); where.push(`(lower(r.number) LIKE $${params.length} OR lower(u.last_name || ' ' || u.first_name) LIKE $${params.length} OR lower(r.title) LIKE $${params.length} OR lower(g.name) LIKE $${params.length})`); }
  const rows = await q(`SELECT r.id, r.number, r.type, r.title, r.status, r.created_at, r.updated_at, r.due_at, (r.due_at < now() AND r.status IN ('submitted','review','preparing')) AS overdue,
                               u.last_name || ' ' || left(u.first_name,1) || '. ' || left(coalesce(u.middle_name,''),1) || '.' AS student, g.name AS group_name, f.short AS faculty
                          FROM requests r JOIN users u ON u.id = r.student_id JOIN students s ON s.user_id = u.id JOIN groups g ON g.id = s.group_id JOIN faculties f ON f.id = g.faculty_id
                         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                         ORDER BY CASE r.status WHEN 'submitted' THEN 0 WHEN 'review' THEN 1 WHEN 'needs_info' THEN 2 WHEN 'preparing' THEN 3 ELSE 4 END, r.created_at DESC LIMIT 200`, params);
  res.json(rows);
});

staff.get('/staff/requests/:id', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Заявка не найдена' });
  const r = await one(`SELECT r.*, u.last_name, u.first_name, u.middle_name, g.name AS group_name, g.course, g.program_code, g.program_name, f.name AS faculty, s.study_form, s.funding
                         FROM requests r JOIN users u ON u.id = r.student_id JOIN students s ON s.user_id = u.id JOIN groups g ON g.id = s.group_id JOIN faculties f ON f.id = g.faculty_id
                        WHERE r.id = $1`, [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Заявка не найдена' });
  const events = await q(`SELECT status, comment, actor_role, actor_name, created_at FROM request_events WHERE request_id = $1 ORDER BY created_at`, [r.id]);
  await audit(req.user!.id, 'staff_view_request', r.id, req.ip);
  const { verify_code, student_id: _sid, ...rest } = r;
  res.json({ ...rest, electronic: !!verify_code, events, typeDef: typeById(r.type) ?? null, allowed: ALLOWED_TRANSITIONS[r.status as Status] });
});

const statusSchema = z.object({ status: z.enum(['submitted', 'review', 'preparing', 'needs_info', 'ready', 'done', 'rejected']), comment: z.string().max(1000).optional() });

staff.post('/staff/requests/:id/status', async (req, res) => {
  const p = statusSchema.safeParse(req.body);
  if (!p.success || !/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Неверные данные' });
  const r = await one(`SELECT id, status, type, payload, student_id, title, number FROM requests WHERE id = $1`, [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Заявка не найдена' });
  const to = p.data.status as Status;
  if (!ALLOWED_TRANSITIONS[r.status as Status].includes(to)) return res.status(409).json({ error: `Нельзя перевести из «${STATUS_LABEL[r.status as Status]}» в «${STATUS_LABEL[to]}»` });
  const comment = p.data.comment?.trim() || null;
  if ((to === 'needs_info' || to === 'rejected') && !comment) return res.status(400).json({ error: 'Напишите студенту, что нужно уточнить или почему отказ' });
  const me = await one(`SELECT last_name || ' ' || left(first_name,1) || '. ' || left(coalesce(middle_name,''),1) || '.' AS name FROM users WHERE id = $1`, [req.user!.id]);
  const def = typeById(r.type);
  const electronic = to === 'ready' && def?.electronic && String(r.payload?.format ?? '').startsWith('Электронная');
  await tx(async (c) => {
    await c.query(`UPDATE requests SET status = $2, updated_at = now() ${electronic ? ', verify_code = coalesce(verify_code, $3)' : ''} WHERE id = $1`, electronic ? [r.id, to, randomToken(9)] : [r.id, to]);
    await c.query(`INSERT INTO request_events(request_id,status,comment,actor_role,actor_name) VALUES ($1,$2,$3,'staff',$4)`, [r.id, to, comment, me?.name ?? 'Деканат']);
    const title = to === 'ready' ? `${r.title}: готово` : to === 'needs_info' ? 'Деканату нужно уточнение' : to === 'rejected' ? `${r.title}: отклонена` : `${r.title}: ${STATUS_LABEL[to].toLowerCase()}`;
    const body = comment ?? (to === 'ready' ? (electronic ? 'Электронный документ с QR уже в кабинете.' : 'Документ можно забрать в деканате.') : `Заявка ${r.number} — ${STATUS_LABEL[to].toLowerCase()}.`);
    await c.query(`INSERT INTO notifications(kind,title,body,link,user_id,author) VALUES ('request',$1,$2,$3,$4,'Деканат')`, [title, body, `/requests/${r.id}`, r.student_id]);
  });
  await audit(req.user!.id, `staff_status_${to}`, r.id, req.ip);
  res.json({ ok: true });
});

staff.get('/staff/audience', async (_req, res) => {
  res.json({ faculties: await q(`SELECT id, name, short FROM faculties ORDER BY id`), groups: await q(`SELECT id, name, faculty_id FROM groups ORDER BY name`) });
});

staff.get('/staff/announcements', async (_req, res) => {
  res.json(await q(`SELECT n.id, n.title, n.body, n.important, n.created_at, n.author, f.short AS faculty, g.name AS group_name
                      FROM notifications n LEFT JOIN faculties f ON f.id = n.faculty_id LEFT JOIN groups g ON g.id = n.group_id
                     WHERE n.kind = 'news' ORDER BY n.created_at DESC LIMIT 50`));
});

const annSchema = z.object({ title: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(1500), audience: z.string().regex(/^(all|faculty:\d+|group:\d+)$/), important: z.boolean().optional() });

staff.post('/staff/announcements', async (req, res) => {
  const p = annSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Заполните заголовок и текст (от 3 символов)' });
  const [kind, idStr] = p.data.audience.split(':');
  const me = await one(`SELECT last_name || ' ' || left(first_name,1) || '.' AS name FROM users WHERE id = $1`, [req.user!.id]);
  const r = await one(`INSERT INTO notifications(kind,title,body,important,faculty_id,group_id,author) VALUES ('news',$1,$2,$3,$4,$5,$6) RETURNING id`,
    [p.data.title, p.data.body, !!p.data.important, kind === 'faculty' ? Number(idStr) : null, kind === 'group' ? Number(idStr) : null, `Деканат · ${me?.name ?? ''}`]);
  await audit(req.user!.id, 'announcement', String(r?.id), req.ip);
  res.status(201).json(r);
});
