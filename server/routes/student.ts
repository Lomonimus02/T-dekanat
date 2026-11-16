import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { audit, requireAuth } from '../auth.js';
import { one, q, tx } from '../db.js';
import { disciplines, notificationsFor, overview, publicProfile, recordBook, schedule, studentCtx, today } from '../lib/data.js';
import { buildDigest, pulse } from '../lib/digest.js';
import { answer, ASSISTANT_SUGGESTIONS } from '../lib/assistant.js';
import { REQUEST_TYPES, typeById } from '../../shared/requests.js';
import { SLOTS, addDays, mondayOf, studyWeek, parityOf, SEMESTER } from '../../shared/time.js';

export const student = Router();
student.use(requireAuth('student'));

const ymdRe = /^\d{4}-\d{2}-\d{2}$/;

async function myRequests(uid: string) {
  return q(`SELECT r.id, r.number, r.type, r.title, r.status, r.payload, r.created_at, r.updated_at, r.due_at, (r.verify_code IS NOT NULL) AS electronic,
                   (SELECT comment FROM request_events e WHERE e.request_id = r.id AND e.comment IS NOT NULL ORDER BY e.created_at DESC LIMIT 1) AS last_comment
              FROM requests r WHERE r.student_id = $1 ORDER BY r.created_at DESC`, [uid]);
}

student.get('/me/profile', async (req, res) => {
  const p = publicProfile(await studentCtx(req.user!.id));
  res.json(p);
});

// Явная проверка: чужой профиль не отдаётся даже по прямому адресу
student.get('/students/:id/profile', async (req, res) => {
  if (req.params.id !== req.user!.id) {
    await audit(req.user!.id, 'forbidden_profile_access', req.params.id, req.ip);
    return res.status(403).json({ error: 'Это не ваш профиль' });
  }
  res.json(publicProfile(await studentCtx(req.user!.id)));
});

student.get('/me/sessions', async (req, res) => {
  const rows = await q(`SELECT id, created_at, last_seen, user_agent, ip FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY last_seen DESC`, [req.user!.id]);
  res.json(rows.map((r) => ({ ...r, current: r.id === req.user!.sessionId, ip: r.ip ? String(r.ip).replace(/(\d+)\.(\d+)$/, '*.*') : null })));
});

student.delete('/me/sessions/:id', async (req, res) => {
  const r = await q(`DELETE FROM sessions WHERE id = $1 AND user_id = $2 AND id <> $3 RETURNING id`, [Number(req.params.id) || 0, req.user!.id, req.user!.sessionId]);
  if (!r.length) return res.status(404).json({ error: 'Сеанс не найден' });
  res.json({ ok: true });
});

student.get('/home', async (req, res) => {
  const uid = req.user!.id;
  const ctx = await studentCtx(uid);
  const t = today();
  const [ds, week, reqs, book, notes] = await Promise.all([
    disciplines(uid, ctx.group_id), schedule(ctx.group_id, t, addDays(t, 13)), myRequests(uid), recordBook(uid), notificationsFor(uid, ctx.group_id, ctx.faculty_id),
  ]);
  const ov = overview(ds, book);
  const todayList = week.filter((o) => o.date === t);
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nextLesson = week.find((o) => (o.date > t || (o.date === t && o.end > hm)) && o.status !== 'cancelled' && o.status !== 'moved_out') ?? null;
  const importantUnread = notes.filter((n) => n.important && !n.read).slice(0, 1);
  res.json({
    today: t, week: studyWeek(t), parity: parityOf(t), semester: SEMESTER,
    profile: { firstName: ctx.first_name, lastName: ctx.last_name, group: ctx.group_name, course: ctx.course, faculty: ctx.faculty_short, avatarHue: ctx.avatar_hue },
    todayLessons: todayList, nextLesson,
    digest: buildDigest(t, ds, week.filter((o) => o.date <= addDays(t, 7)), reqs, ov.debts, importantUnread),
    pulse: pulse(t, week, ds),
    subjects: ds.map((d) => ({ id: d.id, short: d.short, name: d.name, credits: d.credits, control: d.control, state: d.state,
      earned: d.earned, semMax: d.semMax, projectedGrade: d.projectedGrade,
      next: d.next ? { title: d.next.title, date: d.next.date, days: d.next.days, max: d.next.max, final: d.next.final } : null })),
    requests: reqs.filter((r) => !['done', 'rejected'].includes(r.status)).map(({ payload: _p, ...r }) => r),
    overview: { rating: ov.rating, stipend: ov.stipend, debts: ov.debts.length },
    unread: notes.filter((n) => !n.read).length,
    stories: notes.filter((n) => n.kind === 'news').slice(0, 8).map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, important: n.important, author: n.author, created_at: n.created_at, read: n.read })),
  });
});

student.get('/schedule', async (req, res) => {
  const ctx = await studentCtx(req.user!.id);
  const t = today();
  const from = typeof req.query.from === 'string' && ymdRe.test(req.query.from) ? req.query.from : mondayOf(t);
  let to = typeof req.query.to === 'string' && ymdRe.test(req.query.to) ? req.query.to : addDays(from, 6);
  if (to < from || to > addDays(from, 41)) to = addDays(from, 6);
  res.json({ today: t, from, to, week: studyWeek(from), parity: parityOf(from), slots: SLOTS, lessons: await schedule(ctx.group_id, from, to) });
});

student.get('/exams', async (req, res) => {
  const ctx = await studentCtx(req.user!.id);
  const ds = await disciplines(req.user!.id, ctx.group_id);
  const exams = ds.filter((d) => d.exam).map((d) => ({ discipline: { id: d.id, name: d.name, short: d.short, hue: d.hue }, teacher: d.teacher, ...d.exam!, admitted: d.state !== 'risk', projected: d.projectedGrade }))
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  const credits = ds.filter((d) => !d.exam).map((d) => ({ discipline: { id: d.id, name: d.name, short: d.short, hue: d.hue }, control: d.control, date: d.points.find((p) => p.final)?.date, teacher: d.teacher }));
  res.json({ semester: SEMESTER, exams, credits, today: today() });
});

function icsEscape(s: string) { return s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n'); }

student.get('/schedule.ics', async (req, res) => {
  const ctx = await studentCtx(req.user!.id);
  const t = today();
  const from = mondayOf(t);
  const list = (await schedule(ctx.group_id, from, addDays(from, 27))).filter((o) => o.status !== 'cancelled' && o.status !== 'moved_out');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stellar Dekanat concept//RU', 'X-WR-CALNAME:Пары ' + ctx.group_name, 'X-WR-TIMEZONE:Europe/Moscow'];
  for (const o of list) {
    const d = o.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${o.key}@stellar-dekanat`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Moscow:${d}T${o.start.replace(':', '')}00`, `DTEND;TZID=Europe/Moscow:${d}T${o.end.replace(':', '')}00`,
      `SUMMARY:${icsEscape(`${o.discipline.name} · ${o.kind}`)}`, `LOCATION:${icsEscape(o.room)}`, `DESCRIPTION:${icsEscape(o.teacher + (o.change?.reason ? '\n' + o.change.reason : ''))}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stellar-schedule.ics"');
  res.send(lines.join('\r\n'));
});

student.get('/grades', async (req, res) => {
  const ctx = await studentCtx(req.user!.id);
  const [ds, book] = await Promise.all([disciplines(req.user!.id, ctx.group_id), recordBook(req.user!.id)]);
  res.json({ disciplines: ds, overview: overview(ds, book), recordBook: book, semester: SEMESTER, course: ctx.course });
});

student.get('/grades/:id', async (req, res) => {
  const ctx = await studentCtx(req.user!.id);
  const ds = await disciplines(req.user!.id, ctx.group_id);
  const d = ds.find((x) => x.id === Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'Дисциплина не найдена' });
  res.json(d);
});

student.get('/catalog', async (req, res) => {
  const ctx = await studentCtx(req.user!.id);
  const ds = await q(`SELECT name FROM disciplines WHERE group_id = $1 ORDER BY name`, [ctx.group_id]);
  const debts = await q(`SELECT discipline FROM record_book WHERE student_id = $1 AND result IN ('неудовлетворительно','не зачтено')`, [req.user!.id]);
  res.json({ types: REQUEST_TYPES, disciplines: [...debts.map((d) => d.discipline), ...ds.map((d) => d.name)], debts: debts.map((d) => d.discipline), deanOffice: { room: ctx.dean_office_room, hours: ctx.dean_office_hours } });
});

student.get('/requests', async (req, res) => {
  res.json(await myRequests(req.user!.id));
});

const reqLoad = async (uid: string, id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  // Владелец проверяется в самом запросе: чужая заявка неотличима от несуществующей
  return one(`SELECT id, number, type, title, status, payload, created_at, updated_at, due_at, verify_code FROM requests WHERE id = $1 AND student_id = $2`, [id, uid]);
};

student.get('/requests/:id', async (req, res) => {
  const r = await reqLoad(req.user!.id, req.params.id);
  if (!r) {
    await audit(req.user!.id, 'request_not_found_or_foreign', req.params.id, req.ip);
    return res.status(404).json({ error: 'Заявка не найдена' });
  }
  const events = await q(`SELECT status, comment, actor_role, actor_name, created_at FROM request_events WHERE request_id = $1 ORDER BY created_at`, [r.id]);
  const { verify_code, ...rest } = r;
  res.json({ ...rest, electronic: !!verify_code, events, type: typeById(r.type) ?? { id: r.type, title: r.title } });
});

student.get('/requests/:id/document', async (req, res) => {
  const r = await reqLoad(req.user!.id, req.params.id);
  if (!r || !r.verify_code || !['ready', 'done'].includes(r.status)) return res.status(404).json({ error: 'Документ не найден' });
  const p = publicProfile(await studentCtx(req.user!.id));
  const proto = req.get('x-forwarded-proto') ?? req.protocol;
  const url = `${proto}://${req.get('host')}${process.env.BASE_PATH ?? ''}/verify/${r.verify_code}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#0b1020', light: '#ffffff' } });
  const issued = await one(`SELECT created_at FROM request_events WHERE request_id = $1 AND status = 'ready' ORDER BY created_at DESC LIMIT 1`, [r.id]);
  res.json({ number: r.number, title: r.title, payload: r.payload, issuedAt: issued?.created_at ?? r.updated_at, verifyUrl: url, qr, profile: p });
});

const createSchema = z.object({ type: z.string(), fields: z.record(z.string(), z.union([z.string(), z.number()])) });

student.post('/requests', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Проверьте поля формы' });
  const t = typeById(parsed.data.type);
  if (!t) return res.status(400).json({ error: 'Неизвестный тип заявки' });
  const ctx = await studentCtx(req.user!.id);
  const allowedDisc = new Set([...(await q(`SELECT name FROM disciplines WHERE group_id = $1`, [ctx.group_id])).map((d) => d.name),
    ...(await q(`SELECT discipline AS name FROM record_book WHERE student_id = $1`, [req.user!.id])).map((d) => d.name)]);
  const payload: Record<string, string | number> = {};
  for (const f of t.fields) {
    const v = parsed.data.fields[f.name];
    const empty = v === undefined || v === '';
    if (empty) { if (f.required) return res.status(400).json({ error: `Заполните поле «${f.label}»`, field: f.name }); continue; }
    if (f.type === 'select' && !f.options.includes(String(v))) return res.status(400).json({ error: `Недопустимое значение: ${f.label}`, field: f.name });
    if (f.type === 'discipline' && !allowedDisc.has(String(v))) return res.status(400).json({ error: 'Выберите дисциплину из списка', field: f.name });
    if (f.type === 'number') { const n = Number(v); if (!Number.isInteger(n) || n < f.min || n > f.max) return res.status(400).json({ error: `${f.label}: от ${f.min} до ${f.max}`, field: f.name }); payload[f.name] = n; continue; }
    if (f.type === 'date' && !ymdRe.test(String(v))) return res.status(400).json({ error: `${f.label}: неверная дата`, field: f.name });
    if ((f.type === 'text' || f.type === 'textarea') && String(v).length > (f.max ?? 500)) return res.status(400).json({ error: `${f.label}: слишком длинно`, field: f.name });
    payload[f.name] = String(v).trim();
  }
  const recent = await one(`SELECT count(*)::int AS n FROM requests WHERE student_id = $1 AND created_at > now() - interval '1 hour'`, [req.user!.id]);
  if ((recent?.n ?? 0) >= 15) return res.status(429).json({ error: 'Слишком много заявок за час. Попробуйте позже.' });
  const created = await tx(async (c) => {
    const no = (await c.query(`SELECT nextval('request_no') AS n`)).rows[0].n;
    const r = (await c.query(`INSERT INTO requests(number,student_id,type,title,payload,status,due_at) VALUES ($1,$2,$3,$4,$5,'submitted', now() + ($6 || ' days')::interval) RETURNING id, number`,
      [`З-${new Date().getFullYear()}-${String(no).padStart(4, '0')}`, req.user!.id, t.id, t.title, JSON.stringify(payload), String(t.etaDays + (t.etaDays > 2 ? 2 : 0))])).rows[0];
    await c.query(`INSERT INTO request_events(request_id,status,comment,actor_role,actor_name) VALUES ($1,'submitted',NULL,'student','Вы')`, [r.id]);
    return r;
  });
  await audit(req.user!.id, 'request_created', created.id, req.ip);
  res.status(201).json(created);
});

student.post('/requests/:id/reply', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 1000) : '';
  if (!text) return res.status(400).json({ error: 'Напишите ответ' });
  const r = await reqLoad(req.user!.id, req.params.id);
  if (!r) return res.status(404).json({ error: 'Заявка не найдена' });
  if (r.status !== 'needs_info') return res.status(409).json({ error: 'Деканат сейчас не ждёт ответа по этой заявке' });
  await tx(async (c) => {
    await c.query(`UPDATE requests SET status = 'review', updated_at = now() WHERE id = $1`, [r.id]);
    await c.query(`INSERT INTO request_events(request_id,status,comment,actor_role,actor_name) VALUES ($1,'review',$2,'student','Вы')`, [r.id, text]);
  });
  res.json({ ok: true });
});

student.post('/requests/:id/cancel', async (req, res) => {
  const r = await reqLoad(req.user!.id, req.params.id);
  if (!r) return res.status(404).json({ error: 'Заявка не найдена' });
  if (r.status !== 'submitted') return res.status(409).json({ error: 'Заявку уже взяли в работу — отменить можно через вопрос в деканат' });
  await tx(async (c) => {
    await c.query(`UPDATE requests SET status = 'rejected', updated_at = now() WHERE id = $1`, [r.id]);
    await c.query(`INSERT INTO request_events(request_id,status,comment,actor_role,actor_name) VALUES ($1,'rejected','Отменена студентом','student','Вы')`, [r.id]);
  });
  res.json({ ok: true });
});

student.get('/notifications', async (req, res) => {
  const uid = req.user!.id;
  const ctx = await studentCtx(uid);
  const [notes, ds] = await Promise.all([notificationsFor(uid, ctx.group_id, ctx.faculty_id), disciplines(uid, ctx.group_id)]);
  const reminders = ds.flatMap((d) => d.upcoming.filter((u) => !u.final && u.days <= 7).map((u) => ({ id: `cp-${u.id}`, title: u.title, discipline: d.name, disciplineId: d.id, short: d.short, hue: d.hue, date: u.date, days: u.days, max: u.max })))
    .sort((a, b) => a.date.localeCompare(b.date));
  res.json({ items: notes, reminders });
});

student.post('/notifications/read', async (req, res) => {
  const uid = req.user!.id;
  const ctx = await studentCtx(uid);
  const visible = (await notificationsFor(uid, ctx.group_id, ctx.faculty_id)).map((n) => n.id);
  const ids: number[] = req.body?.all ? visible : (Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((id: number) => visible.includes(id)) : []);
  if (ids.length) await q(`INSERT INTO notification_reads(user_id, notification_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`, [uid, ids]);
  res.json({ ok: true, marked: ids.length });
});

student.get('/assistant', (_req, res) => res.json({ suggestions: ASSISTANT_SUGGESTIONS }));

student.post('/assistant', async (req, res) => {
  const question = typeof req.body?.q === 'string' ? req.body.q.slice(0, 300) : '';
  if (!question.trim()) return res.status(400).json({ error: 'Пустой вопрос' });
  const uid = req.user!.id;
  const ctx = await studentCtx(uid);
  const t = today();
  const [ds, week, reqs, book] = await Promise.all([disciplines(uid, ctx.group_id), schedule(ctx.group_id, t, addDays(t, 13)), myRequests(uid), recordBook(uid)]);
  res.json(answer(question, { t, profile: publicProfile(ctx), ds, week, requests: reqs, overview: overview(ds, book) }));
});
