// Поиск и ответы на вопросы — локальный помощник без внешних ИИ-сервисов: разбирает вопрос правилами
// и отвечает только по данным того студента, который спрашивает. Ничего не уходит наружу.
import { SLOTS, WEEKDAYS, addDays, humanDate, isoWeekday, plural, relDays } from '../../shared/time.js';
import { STATUS_LABEL } from '../../shared/requests.js';
import type { Occurrence } from './data.js';

type Ctx = { t: string; profile: any; ds: any[]; week: Occurrence[]; requests: any[]; overview: any };
export type Answer = { text: string; links: { label: string; to: string }[] };

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

function lessonLine(o: Occurrence) {
  if (o.status === 'cancelled') return `${o.start} ${o.discipline.short} — отменена`;
  if (o.status === 'moved_out') return `${o.start} ${o.discipline.short} — перенесена`;
  return `${o.start}–${o.end} ${o.discipline.name} (${o.kind.toLowerCase()}), ${o.room}`;
}

export function answer(question: string, c: Ctx): Answer {
  const q = norm(question).trim();
  const disc = c.ds.find((d) => q.includes(norm(d.short)) || norm(d.name).split(' ').some((w: string) => w.length > 4 && q.includes(w.slice(0, -1))));

  if (/завтра|сегодня|пар[аыу]|расписан|занят|где.*(лекц|семинар)|во сколько/.test(q)) {
    const day = /завтра/.test(q) ? addDays(c.t, 1) : c.t;
    const list = c.week.filter((o) => o.date === day && o.status !== 'moved_out');
    const label = day === c.t ? 'Сегодня' : 'Завтра';
    if (!list.length) {
      const next = c.week.find((o) => o.date > day && o.status !== 'cancelled' && o.status !== 'moved_out');
      return { text: `${label} пар нет.${next ? ` Следующая — ${WEEKDAYS[isoWeekday(next.date)].toLowerCase()}, ${next.start}: ${next.discipline.name}, ${next.room}.` : ''}`, links: [{ label: 'Расписание', to: '/schedule' }] };
    }
    return { text: `${label}, ${humanDate(day)}:\n` + list.map(lessonLine).join('\n'), links: [{ label: 'Открыть день', to: `/schedule?date=${day}` }] };
  }
  if (/экзамен|сесси|консультац/.test(q)) {
    const ex = c.ds.filter((d) => d.exam).sort((a, b) => a.exam.startsAt.localeCompare(b.exam.startsAt));
    if (disc?.exam) return { text: `${disc.name}: экзамен ${humanDate(disc.exam.startsAt.slice(0, 10))} в ${new Date(disc.exam.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}, ${disc.exam.room}. Консультация накануне в 15:00.`, links: [{ label: 'Сессия', to: '/schedule?tab=session' }] };
    return { text: 'Экзамены зимней сессии:\n' + ex.map((d) => `${humanDate(d.exam.startsAt.slice(0, 10))} — ${d.name}, ${d.exam.room}`).join('\n'), links: [{ label: 'Сессия', to: '/schedule?tab=session' }] };
  }
  if (/справк|заявк|заявлен|статус|документ|военкомат/.test(q)) {
    const active = c.requests.filter((r) => !['done', 'rejected'].includes(r.status));
    if (/как|заказать|получить|нужна/.test(q) || !active.length) return { text: 'Справку можно заказать в два касания: «Заявки» → выберите тип → «Отправить». Справка об обучении в электронном виде с QR готова за рабочий день.', links: [{ label: 'Заказать справку', to: '/requests/new/study_cert' }, { label: 'Все заявки', to: '/requests' }] };
    return { text: 'Ваши заявки в работе:\n' + active.map((r) => `${r.number} · ${r.title} — ${STATUS_LABEL[r.status as keyof typeof STATUS_LABEL].toLowerCase()}`).join('\n'), links: active.slice(0, 2).map((r) => ({ label: r.number, to: `/requests/${r.id}` })) };
  }
  if (/стипенд/.test(q)) return { text: `${c.overview.stipend.title}. ${c.overview.stipend.text}`, links: [{ label: 'Успеваемость', to: '/grades' }] };
  if (/долг|пересдач|задолж/.test(q)) {
    if (!c.overview.debts.length) return { text: 'Академических задолженностей нет.', links: [] };
    return { text: `Задолженности: ${c.overview.debts.map((d: any) => d.discipline).join(', ')}. Возьмите направление на пересдачу онлайн — без него к пересдаче не допускают.`, links: [{ label: 'Направление на пересдачу', to: '/requests/new/retake' }] };
  }
  if (/дедлайн|сдать|срок|задани|контрольн|когда/.test(q)) {
    const list = c.ds.flatMap((d) => d.upcoming.filter((u: any) => !u.final).map((u: any) => ({ ...u, d }))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    if (!list.length) return { text: 'Ближайших сдач нет.', links: [] };
    return { text: 'Ближайшие сдачи:\n' + list.map((u) => `${humanDate(u.date)} (${relDays(u.days)}) — ${u.title}, ${u.d.short}`).join('\n'), links: [{ label: 'Дедлайны на главной', to: '/' }] };
  }
  if (disc || /балл|оценк|рейтинг|успева|как у меня/.test(q)) {
    if (disc) return { text: `${disc.name}: ${disc.earned} из ${disc.gradedMax} баллов за сданные работы (средний результат ${Math.round(disc.pace * 100)}%). Прогноз — ${disc.projectedTotal} баллов, «${disc.projectedGrade.label}».${disc.needForAdmission ? ` До допуска не хватает ${disc.needForAdmission}.` : ''}`, links: [{ label: 'Подробнее и прогноз', to: `/grades/${disc.id}` }] };
    const risk = c.ds.filter((d) => d.state !== 'ok');
    return { text: `Рейтинг семестра — ${c.overview.rating} из 100. ${risk.length ? `Внимания требуют: ${risk.map((d) => d.short).join(', ')}.` : 'Все дисциплины идут по графику.'}`, links: [{ label: 'Успеваемость', to: '/grades' }] };
  }
  if (/деканат|кабинет|часы|телефон|куратор|где.*(находит|офис)/.test(q)) {
    const o = c.profile.deanOffice;
    return { text: `Деканат ${c.profile.facultyShort}: ${o.room}, ${o.hours}, тел. ${o.phone}. Куратор группы — ${c.profile.curator}. Вопрос можно задать онлайн.`, links: [{ label: 'Вопрос в деканат', to: '/requests/new/question' }] };
  }
  if (/привет|здравств|добр/.test(q)) return { text: `Здравствуйте, ${c.profile.firstName}! Спросите, например: «какие пары завтра», «сколько баллов по ${c.ds[0]?.short}», «статус справки».`, links: [] };
  return {
    text: 'Пока я понимаю вопросы про пары, сдачи, баллы, экзамены, стипендию, задолженности, заявки и деканат. Попробуйте: «что сдать на этой неделе?»',
    links: [{ label: 'Вопрос живому специалисту', to: '/requests/new/question' }],
  };
}

export const ASSISTANT_SUGGESTIONS = ['Какие пары завтра?', 'Что сдать на этой неделе?', 'Как у меня с баллами?', 'Статус моих заявок', 'Когда экзамены?', 'Где деканат?'];
export const SLOT_COUNT = Object.keys(SLOTS).length;
export const _p = plural;
