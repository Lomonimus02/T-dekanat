import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight, CalendarX2, GraduationCap, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBox, Skeleton } from '../components/ui';
import { LessonCard, type Occ } from '../components/Lesson';
import { addDays, dayShort, dayTitle, diffDays, humanDate, mondayOf, plural, relDays, timeOf, ymd } from '../lib/format';
import { useNow, useTitle } from '../lib/hooks';

export function SchedulePage() {
  useTitle('Расписание');
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'session' ? 'session' : 'week';
  const today = ymd(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('date') ?? '') ? sp.get('date')! : (new Date().getDay() === 0 ? addDays(today, 1) : today);
  const from = mondayOf(date);
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v == null ? n.delete(k) : n.set(k, v);
    setSp(n, { replace: true });
  };

  return (
    <div className="page sched-page">
      <div className="sched-head">
        <h1 className="h1">Расписание</h1>
        <div className="seg seg-sm" role="tablist" aria-label="Раздел расписания">
          <button role="tab" aria-selected={tab === 'week'} className={tab === 'week' ? 'on' : ''} onClick={() => set({ tab: null })}>Занятия</button>
          <button role="tab" aria-selected={tab === 'session'} className={tab === 'session' ? 'on' : ''} onClick={() => set({ tab: 'session' })}>Сессия</button>
        </div>
        <a className="icon-btn icon-btn-soft" href="/dekanat/api/schedule.ics" aria-label="Экспорт в календарь (.ics)" title="Экспорт в календарь: занятия на 4 недели"><CalendarPlus size={19} /></a>
      </div>
      {tab === 'week' ? <Week from={from} date={date} today={today} set={set} /> : <Session />}
    </div>
  );
}

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'нояб', 'дек'];
const shortRange = (a: string, b: string) => {
  const ma = Number(a.slice(5, 7)) - 1, mb = Number(b.slice(5, 7)) - 1;
  return ma === mb ? `${Number(a.slice(8))}–${Number(b.slice(8))} ${MONTH_SHORT[mb]}` : `${Number(a.slice(8))} ${MONTH_SHORT[ma]} – ${Number(b.slice(8))} ${MONTH_SHORT[mb]}`;
};

function Week({ from, date, today, set }: { from: string; date: string; today: string; set: (p: Record<string, string | null>) => void }) {
  const q = useQuery<any>({ queryKey: ['schedule', from], queryFn: () => api(`/schedule?from=${from}`), placeholderData: keepPreviousData });
  const now = useNow();
  const hm = new Date(now).toTimeString().slice(0, 5);
  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(from, i)), [from]);
  const lessons: Occ[] = q.data?.lessons ?? [];
  const byDay = (d: string) => lessons.filter((o) => o.date === d);
  const sel = days.includes(date) ? date : days[0];
  const thisWeek = days.includes(today);

  return (
    <>
      <div className="sched-bar">
        <div className="week-nav">
          <button className="icon-btn" onClick={() => set({ date: addDays(from, -7) })} aria-label="Предыдущая неделя"><ChevronLeft size={20} /></button>
          <button className="week-label" onClick={() => set({ date: null })} disabled={thisWeek} title={thisWeek ? undefined : 'К текущей неделе'}>
            <b>{shortRange(from, addDays(from, 5))}</b>
            <span>{q.data ? `${q.data.week}-я · ${q.data.parity === 'odd' ? 'нечётная' : 'чётная'}` : '…'}</span>
          </button>
          <button className="icon-btn" onClick={() => set({ date: addDays(from, 7) })} aria-label="Следующая неделя"><ChevronRight size={20} /></button>
        </div>
        <div className="day-strip" role="tablist" aria-label="Дни недели">
          {days.map((d) => {
            const list = byDay(d);
            const n = list.filter((o) => o.status !== 'cancelled' && o.status !== 'moved_out').length;
            const changed = list.some((o) => o.status !== 'normal');
            return (
              <button key={d} role="tab" aria-selected={d === sel} className={`day ${d === sel ? 'on' : ''} ${d === today ? 'is-today' : ''}`} onClick={() => set({ date: d })}
                aria-label={`${dayTitle(d)}${d === today ? ', сегодня' : ''}: ${n} ${plural(n, 'занятие', 'занятия', 'занятий')}${changed ? ', есть изменения' : ''}`}>
                <span className="day-w">{dayShort(d)}</span>
                <span className="day-n num">{Number(d.slice(8))}</span>
                {changed && <i className="day-ch" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {q.isLoading ? (
        <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={96} r={18} />)}</div>
      ) : q.error ? (
        <ErrorBox error={q.error} retry={q.refetch} />
      ) : byDay(sel).length ? (
        <div className="stack sched-list">{byDay(sel).map((o) => <LessonCard key={o.key} o={o} now={sel === today ? hm : undefined} />)}</div>
      ) : (
        <div className="day-empty"><CalendarX2 size={22} /><span>{sel === today ? 'Сегодня занятий нет' : 'Занятий нет'}</span></div>
      )}
    </>
  );
}

function Session() {
  const q = useQuery<any>({ queryKey: ['exams'], queryFn: () => api('/exams') });
  if (q.isLoading) return <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={80} r={18} />)}</div>;
  if (q.error) return <ErrorBox error={q.error} retry={q.refetch} />;
  const d = q.data;
  return (
    <div className="stack">
      <p className="sess-note"><GraduationCap size={18} /> <span><b>Сессия {humanDate(d.semester.sessionStart)} — {humanDate(d.semester.sessionEnd)}</b> · первый экзамен {relDays(diffDays(d.today, d.exams[0]?.startsAt.slice(0, 10) ?? d.semester.sessionStart))}</span></p>
      <div className="panel list-card">
        {d.exams.map((e: any) => {
          const day = e.startsAt.slice(0, 10);
          return (
            <Link key={e.discipline.id} to={`/grades/${e.discipline.id}`} className="exam-row">
              <span className="exam-date"><span className="num">{Number(day.slice(8))}</span><span>{dayShort(day)}</span></span>
              <span className="exam-body">
                <b>{e.discipline.name}</b>
                <span className="faint">Экзамен · {timeOf(e.startsAt)} · {e.room} · консультация {humanDate(e.consultationAt.slice(0, 10))}</span>
              </span>
              {e.admitted ? <ShieldCheck size={18} className="ok-ic" aria-label="Допуск в графике" /> : <ShieldAlert size={18} className="bad-ic" aria-label="Допуск под угрозой" />}
            </Link>
          );
        })}
        {d.credits.map((c: any) => (
          <Link key={c.discipline.id} to={`/grades/${c.discipline.id}`} className="exam-row">
            <span className="exam-date is-credit"><span className="num">{c.date ? Number(c.date.slice(8)) : '—'}</span><span>{c.date ? dayShort(c.date) : ''}</span></span>
            <span className="exam-body">
              <b>{c.discipline.name}</b>
              <span className="faint">{c.control === 'diff' ? 'Дифференцированный зачёт' : 'Зачёт'}{c.date ? ` · ${humanDate(c.date)}` : ''}</span>
            </span>
            <ChevronRight size={18} className="faint" />
          </Link>
        ))}
      </div>
    </div>
  );
}
