import { STATUS_LABEL, type Status } from '../../shared/requests.js';
import { ADMISSION_MIN } from '../../shared/grading.js';
import { SLOTS, WEEKDAYS_SHORT, addDays, diffDays, humanDate, isoWeekday, plural, relDays } from '../../shared/time.js';
import type { Occurrence } from './data.js';

export type DigestItem = {
  id: string; tone: 'urgent' | 'warn' | 'info' | 'good'; kind: 'deadline' | 'change' | 'request' | 'risk' | 'debt' | 'news';
  title: string; text: string; date?: string; action?: { label: string; to: string };
};

const KIND_WORD: Record<string, string> = { moved_out: 'Перенос', moved_in: 'Перенос', cancelled: 'Отмена', room: 'Другая аудитория', teacher: 'Замена' };

export function buildDigest(t: string, ds: any[], week: Occurrence[], requests: any[], debts: any[], importantNews: any[]): DigestItem[] {
  const items: (DigestItem & { w: number })[] = [];
  for (const r of requests) {
    if (r.status === 'needs_info') items.push({ id: `r-${r.id}`, w: 0, tone: 'urgent', kind: 'request', title: `Деканат ждёт ответа по заявке ${r.number}`, text: r.last_comment ?? 'Нужно уточнение', action: { label: 'Ответить', to: `/requests/${r.id}` } });
    if (r.status === 'ready') items.push({ id: `r-${r.id}`, w: 3, tone: 'good', kind: 'request', title: `${r.title}: готово`, text: r.electronic ? 'Электронный документ с QR — можно скачать прямо сейчас.' : 'Можно забрать в деканате.', action: { label: r.electronic ? 'Открыть документ' : 'Подробнее', to: `/requests/${r.id}` } });
  }
  for (const d of debts) items.push({ id: `debt-${d.discipline}`, w: 1, tone: 'urgent', kind: 'debt', title: `Академическая задолженность: ${d.discipline}`, text: `Без направления на пересдачу к преподавателю не допустят. ${d.teacher} принимает по графику пересдач.`, action: { label: 'Взять направление', to: '/requests/new/retake' } });
  for (const d of ds) {
    if (d.state === 'risk' && d.needForAdmission > 0) {
      const left = d.remainingMax;
      const share = left ? Math.ceil((d.needForAdmission / left) * 100) : 100;
      items.push({ id: `risk-${d.id}`, w: 1, tone: 'urgent', kind: 'risk', title: `${d.name}: до допуска ${d.needForAdmission} ${plural(d.needForAdmission, 'балл', 'балла', 'баллов')}`,
        text: left ? `В оставшихся работах можно набрать ${left}. Нужно взять хотя бы ${Math.min(100, share)}% — ближайшая: «${d.next?.title}», ${humanDate(d.next?.date ?? t)}.` : 'Работ в семестре больше нет — поговорите с преподавателем.',
        action: { label: 'Посчитать шансы', to: `/grades/${d.id}` } });
    } else if (d.state === 'attention') {
      items.push({ id: `att-${d.id}`, w: 4, tone: 'warn', kind: 'risk', title: `${d.name}: средний результат ${Math.round(d.pace * 100)}%`, text: `Прогноз — «${d.projectedGrade.label}». Хорошо сданная «${d.next?.title ?? 'следующая работа'}» поднимет итог.`, action: { label: 'Что нужно для «хорошо»', to: `/grades/${d.id}` } });
    }
    for (const u of d.upcoming.filter((u: any) => !u.final && u.days <= 7)) {
      items.push({ id: `cp-${u.id}`, w: 2 + u.days / 10, tone: u.days <= 2 ? 'urgent' : 'warn', kind: 'deadline', date: u.date, title: `${u.title} · ${d.short}`,
        text: `${d.name}, до ${u.max} ${plural(u.max, 'балла', 'баллов', 'баллов')}. Срок — ${relDays(u.days)}, ${humanDate(u.date, true)}.`, action: { label: 'К дисциплине', to: `/grades/${d.id}` } });
    }
  }
  for (const o of week.filter((o) => o.status !== 'normal' && o.status !== 'moved_in')) {
    const when = `${WEEKDAYS_SHORT[isoWeekday(o.date)]}, ${humanDate(o.date)}`;
    let text = o.change?.reason ?? '';
    if (o.status === 'moved_out' && o.change?.toDate) text = `${when} → ${WEEKDAYS_SHORT[isoWeekday(o.change.toDate)]}, ${humanDate(o.change.toDate)}, ${SLOTS[o.change.toSlot ?? o.slot][0]}. ${text}`;
    if (o.status === 'room') text = `${when}: ${o.change?.oldRoom} → ${o.room}. ${text}`;
    if (o.status === 'cancelled') text = `${when}, ${o.start}. ${text}`;
    if (o.status === 'teacher') text = `${when}: ведёт ${o.teacher}. ${text}`;
    items.push({ id: `ch-${o.key}`, w: 2.5 + diffDays(t, o.date) / 10, tone: 'info', kind: 'change', date: o.date, title: `${KIND_WORD[o.status]}: ${o.discipline.name}`, text, action: { label: 'В расписание', to: `/schedule?date=${o.date}` } });
  }
  for (const n of importantNews) items.push({ id: `n-${n.id}`, w: 5, tone: 'info', kind: 'news', title: n.title, text: n.body, action: { label: 'Открыть уведомления', to: '/notifications' } });
  return items.sort((a, b) => a.w - b.w).slice(0, 8).map(({ w: _w, ...x }) => x);
}

export function pulse(t: string, occ: Occurrence[], ds: any[]) {
  const days = [] as { date: string; lessons: number; deadlines: number; changes: number }[];
  for (let i = 0; i < 7; i++) {
    const d = addDays(t, i);
    if (isoWeekday(d) === 7) continue;
    const lessons = occ.filter((o) => o.date === d && o.status !== 'cancelled' && o.status !== 'moved_out').length;
    const changes = occ.filter((o) => o.date === d && o.status !== 'normal').length;
    const deadlines = ds.reduce((s, x) => s + x.upcoming.filter((u: any) => u.date === d).length, 0);
    days.push({ date: d, lessons, deadlines, changes });
  }
  return days;
}

export function statusLine(s: Status) { return STATUS_LABEL[s]; }
export { ADMISSION_MIN };
