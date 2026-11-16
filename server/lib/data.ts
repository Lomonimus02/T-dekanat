import { one, q } from '../db.js';
import { decrypt } from './crypto.js';
import { ADMISSION_MIN, gradeFor, type Control } from '../../shared/grading.js';
import { SLOTS, addDays, diffDays, isoWeekday, parityOf, ymd } from '../../shared/time.js';

export const today = () => ymd(new Date());

export async function studentCtx(uid: string) {
  const s = await one(`
    SELECT u.id, u.login, u.last_name, u.first_name, u.middle_name, st.*, g.name AS group_name, g.program_code, g.program_name, g.profile, g.course, g.curator,
           f.id AS faculty_id, f.name AS faculty_name, f.short AS faculty_short, f.dean_office_room, f.dean_office_hours, f.dean_office_phone
      FROM users u JOIN students st ON st.user_id = u.id JOIN groups g ON g.id = st.group_id JOIN faculties f ON f.id = g.faculty_id
     WHERE u.id = $1`, [uid]);
  if (!s) throw Object.assign(new Error('not a student'), { status: 404 });
  return s;
}

export function publicProfile(s: any) {
  return {
    id: s.id,
    login: s.login,
    lastName: s.last_name, firstName: s.first_name, middleName: s.middle_name,
    faculty: s.faculty_name, facultyShort: s.faculty_short,
    programCode: s.program_code, program: s.program_name, profile: s.profile,
    course: s.course, group: s.group_name, curator: s.curator,
    studyForm: s.study_form, funding: s.funding, enrolledYear: s.enrolled_year, stipend: s.stipend,
    avatarHue: s.avatar_hue,
    recordBook: decrypt(s.record_book_enc), email: decrypt(s.email_enc), phone: decrypt(s.phone_enc), birthDate: decrypt(s.birth_date_enc),
    deanOffice: { room: s.dean_office_room, hours: s.dean_office_hours, phone: s.dean_office_phone },
  };
}

export type Occurrence = {
  key: string; date: string; slot: number; start: string; end: string;
  discipline: { id: number; code: string; name: string; short: string; hue: number };
  kind: string; room: string; teacher: string;
  status: 'normal' | 'moved_out' | 'moved_in' | 'cancelled' | 'room' | 'teacher';
  change?: { reason: string | null; fromDate?: string; fromSlot?: number; toDate?: string; toSlot?: number; oldRoom?: string; oldTeacher?: string };
};

export async function schedule(groupId: number, from: string, to: string): Promise<Occurrence[]> {
  const lessons = await q(`SELECT l.*, d.code, d.name, d.short, d.hue FROM lessons l JOIN disciplines d ON d.id = l.discipline_id WHERE d.group_id = $1`, [groupId]);
  const changes = await q(`SELECT lc.* FROM lesson_changes lc JOIN lessons l ON l.id = lc.lesson_id JOIN disciplines d ON d.id = l.discipline_id
                           WHERE d.group_id = $1 AND (lc.on_date BETWEEN $2 AND $3 OR lc.new_date BETWEEN $2 AND $3)`, [groupId, from, to]);
  const out: Occurrence[] = [];
  const base = (l: any, date: string, slot: number): Occurrence => ({
    key: `${l.id}:${date}:${slot}`, date, slot, start: SLOTS[slot][0], end: SLOTS[slot][1],
    discipline: { id: l.discipline_id, code: l.code, name: l.name, short: l.short, hue: l.hue },
    kind: l.kind, room: l.room, teacher: l.teacher, status: 'normal',
  });
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    for (const l of lessons) {
      if (l.weekday !== wd || (l.parity !== 'all' && l.parity !== parityOf(d))) continue;
      const o = base(l, d, l.slot);
      const ch = changes.find((c) => c.lesson_id === l.id && c.on_date === d);
      if (ch) {
        if (ch.kind === 'moved') { o.status = 'moved_out'; o.change = { reason: ch.reason, toDate: ch.new_date, toSlot: ch.new_slot }; }
        if (ch.kind === 'cancelled') { o.status = 'cancelled'; o.change = { reason: ch.reason }; }
        if (ch.kind === 'room') { o.status = 'room'; o.change = { reason: ch.reason, oldRoom: o.room }; o.room = ch.new_room; }
        if (ch.kind === 'teacher') { o.status = 'teacher'; o.change = { reason: ch.reason, oldTeacher: o.teacher }; o.teacher = ch.new_teacher; }
      }
      out.push(o);
    }
  }
  for (const ch of changes.filter((c) => c.kind === 'moved' && c.new_date >= from && c.new_date <= to)) {
    const l = lessons.find((x) => x.id === ch.lesson_id);
    if (!l) continue;
    const o = base(l, ch.new_date, ch.new_slot ?? l.slot);
    o.key += ':in';
    o.status = 'moved_in';
    o.change = { reason: ch.reason, fromDate: ch.on_date, fromSlot: l.slot };
    out.push(o);
  }
  return out.sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
}

export async function disciplines(uid: string, groupId: number) {
  const ds = await q(`SELECT * FROM disciplines WHERE group_id = $1 ORDER BY id`, [groupId]);
  const cps = await q(`SELECT cp.*, s.score, s.graded_at FROM control_points cp JOIN disciplines d ON d.id = cp.discipline_id
                        LEFT JOIN scores s ON s.control_point_id = cp.id AND s.student_id = $1
                       WHERE d.group_id = $2 ORDER BY cp.due_date`, [uid, groupId]);
  const att = await q(`SELECT * FROM attendance WHERE student_id = $1`, [uid]);
  const exams = await q(`SELECT e.* FROM exams e JOIN disciplines d ON d.id = e.discipline_id WHERE d.group_id = $1`, [groupId]);
  const t = today();
  return ds.map((d) => {
    const mine = cps.filter((c) => c.discipline_id === d.id);
    const isFinal = (c: any) => ['экзамен', 'зачёт'].includes(c.kind);
    const sem = mine.filter((c) => !isFinal(c));
    const fin = mine.find(isFinal);
    const graded = sem.filter((c) => c.score != null);
    const earned = graded.reduce((s, c) => s + c.score, 0);
    const gradedMax = graded.reduce((s, c) => s + c.max_score, 0);
    const semMax = sem.reduce((s, c) => s + c.max_score, 0);
    const remainingMax = semMax - gradedMax;
    const pace = gradedMax ? earned / gradedMax : 0;
    const projectedSemester = Math.round((earned + pace * remainingMax) * 10) / 10;
    const projectedTotal = Math.round(projectedSemester + pace * (fin?.max_score ?? 40));
    const needForAdmission = Math.max(0, ADMISSION_MIN - earned);
    let state: 'ok' | 'attention' | 'risk' = 'ok';
    if (projectedSemester < ADMISSION_MIN || pace < 0.55) state = 'risk';
    else if (pace < 0.72) state = 'attention';
    const a = att.find((x) => x.discipline_id === d.id);
    const upcoming = mine.filter((c) => c.score == null && c.due_date >= t).map((c) => ({ id: c.id, title: c.title, kind: c.kind, date: c.due_date, max: c.max_score, days: diffDays(t, c.due_date), final: isFinal(c) }));
    const exam = exams.find((e) => e.discipline_id === d.id);
    return {
      id: d.id, code: d.code, name: d.name, short: d.short, teacher: d.teacher, credits: d.credits, control: d.control as Control, hue: d.hue,
      earned, gradedMax, semMax, remainingMax, pace: Math.round(pace * 100) / 100,
      projectedSemester, projectedTotal, projectedGrade: gradeFor(projectedTotal, d.control), state, needForAdmission,
      attendance: a ? { attended: a.attended, total: a.total } : null,
      points: mine.map((c) => ({ id: c.id, title: c.title, kind: c.kind, date: c.due_date, max: c.max_score, score: c.score, final: isFinal(c) })),
      upcoming,
      next: upcoming[0] ?? null,
      exam: exam ? { startsAt: exam.starts_at, room: exam.room, consultationAt: exam.consultation_at, consultationRoom: exam.consultation_room } : null,
    };
  });
}

export async function recordBook(uid: string) {
  return q(`SELECT semester, discipline, control, result, points, credits, teacher, passed_on FROM record_book WHERE student_id = $1 ORDER BY semester, passed_on`, [uid]);
}

const NUM: Record<string, number> = { 'отлично': 5, 'хорошо': 4, 'удовлетворительно': 3, 'неудовлетворительно': 2 };

export function overview(ds: Awaited<ReturnType<typeof disciplines>>, book: any[]) {
  const totalCredits = ds.reduce((s, d) => s + d.credits, 0);
  const rating = Math.round(ds.reduce((s, d) => s + d.pace * 100 * d.credits, 0) / Math.max(1, totalCredits));
  const graded = ds.filter((d) => d.control !== 'zachet');
  const counts = { top: 0, good: 0, ok: 0, bad: 0 } as Record<string, number>;
  for (const d of ds) counts[d.projectedGrade.tone]++;
  const debts = book.filter((r) => ['неудовлетворительно', 'не зачтено'].includes(r.result));
  const lowGrades = graded.filter((d) => d.projectedGrade.tone === 'ok' || d.projectedGrade.tone === 'bad');
  let stipend: { tone: 'top' | 'good' | 'ok' | 'bad'; title: string; text: string };
  if (debts.length) stipend = { tone: 'bad', title: 'Стипендия не начисляется', text: `Сначала закройте задолженность: ${debts.map((d) => d.discipline).join(', ')}. После сессии без троек стипендию назначат снова.` };
  else if (ds.some((d) => d.projectedGrade.tone === 'bad')) stipend = { tone: 'bad', title: 'Стипендия под угрозой', text: `По прогнозу есть риск не сдать: ${ds.filter((d) => d.projectedGrade.tone === 'bad').map((d) => d.name).join(', ')}.` };
  else if (lowGrades.length) stipend = { tone: 'ok', title: 'Стипендия под вопросом', text: `Прогноз «удовлетворительно»: ${lowGrades.map((d) => d.name).join(', ')}. Тройка в сессию — минус стипендия на полгода.` };
  else if (graded.every((d) => d.projectedGrade.tone === 'top')) stipend = { tone: 'top', title: 'Претендуете на повышенную', text: 'По прогнозу все экзамены на «отлично». Подайте заявку до 30 ноября.' };
  else stipend = { tone: 'good', title: 'Стипендия сохраняется', text: 'По прогнозу сессия без троек.' };
  const semesters = new Map<number, number[]>();
  for (const r of book) if (NUM[r.result]) semesters.set(r.semester, [...(semesters.get(r.semester) ?? []), NUM[r.result]]);
  const gpa = [...semesters].map(([semester, arr]) => ({ semester, gpa: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 }));
  return { rating, counts, stipend, debts: debts.map((d) => ({ discipline: d.discipline, semester: d.semester, teacher: d.teacher })), gpa, credits: totalCredits };
}

export async function notificationsFor(uid: string, groupId: number, facultyId: number) {
  return q(`SELECT n.id, n.kind, n.title, n.body, n.link, n.important, n.author, n.created_at,
                   (n.user_id IS NOT NULL) AS personal, (r.user_id IS NOT NULL) AS read
              FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = $1
             WHERE n.user_id = $1
                OR (n.user_id IS NULL AND n.faculty_id IS NULL AND n.group_id IS NULL)
                OR (n.user_id IS NULL AND n.faculty_id = $3 AND n.group_id IS NULL)
                OR (n.user_id IS NULL AND n.group_id = $2)
             ORDER BY n.created_at DESC LIMIT 100`, [uid, groupId, facultyId]);
}
