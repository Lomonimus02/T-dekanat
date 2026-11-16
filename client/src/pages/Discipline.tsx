import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, Check, ChevronDown, Hourglass, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, ErrorBox, PageSkeleton, Panel, STATE_LABEL, TONE_COLOR } from '../components/ui';
import { ADMISSION_MIN, CONTROL_LABEL, THRESHOLDS, gradeFor } from '../../../shared/grading';
import { diffDays, humanDate, relDays, timeOf, ymd } from '../lib/format';
import { useTitle } from '../lib/hooks';
import { Ring } from './Grades';

export function DisciplinePage() {
  const { id } = useParams();
  const q = useQuery<any>({ queryKey: ['disc', id], queryFn: () => api(`/grades/${id}`) });
  useTitle(q.data?.name ?? 'Дисциплина');
  if (q.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (q.error) return <div className="page"><Back />{(q.error as any).status === 404 ? <Panel><Empty icon={<SearchX size={24} />} title="Дисциплина не найдена" text="Возможно, её нет в вашем учебном плане." action={<Link className="btn btn-ghost btn-sm" to="/grades">К успеваемости</Link>} /></Panel> : <ErrorBox error={q.error} retry={q.refetch} />}</div>;
  const d = q.data;
  return (
    <div className="page">
      <Back />
      <div className="page-head">
        <div>
          <h1 className="h1">{d.name}</h1>
          <p className="page-sub">{CONTROL_LABEL[d.control as 'exam']} · {d.credits} з. е. · {d.teacher}</p>
        </div>
        <span className={`chip tone-${d.state === 'ok' ? 'ok-state' : d.state}`} style={{ height: 30 }}><span className="pip" />{STATE_LABEL[d.state]}</span>
      </div>
      <div className="disc-page">
        <div className="grid" style={{ gap: 18, alignContent: 'start' }}>
          <div className="panel list-card disc-card">
            <div className="mini-stats">
              <span><b className="num">{d.earned}<small>/{d.gradedMax}</small></b><span>набрано</span></span>
              <span><b className="num">{Math.round(d.pace * 100)}<small>%</small></b><span>средний результат</span></span>
              <span><b className="num">{d.attendance ? Math.round((d.attendance.attended / d.attendance.total) * 100) : '—'}<small>%</small></b><span>посещаемость</span></span>
            </div>
            <ol className="cps">
              {d.points.map((p: any) => {
                const done = p.score != null;
                const exam = p.final && d.exam;
                return (
                  <li key={p.id} className={`cp ${done ? 'is-done' : ''} ${p.final ? 'is-final' : ''}`}>
                    <span className="cp-dot">{done ? <Check size={12} /> : p.final ? <CalendarClock size={12} /> : <Hourglass size={12} />}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{p.title}</div>
                      <div className="faint" style={{ fontSize: 12.5 }}>
                        {exam ? `${humanDate(d.exam.startsAt.slice(0, 10))}, ${timeOf(d.exam.startsAt)} · ${d.exam.room} · консультация ${humanDate(d.exam.consultationAt.slice(0, 10))}` : humanDate(p.date)}
                        {!done && !p.final && ` · ${relDays(diffDays(ymd(new Date()), p.date))}`}
                      </div>
                    </div>
                    <div className="cp-score mono">{done ? <><b>{p.score}</b><span className="faint"> / {p.max}</span></> : <span className="faint">до {p.max}</span>}</div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <Simulator d={d} />
      </div>
    </div>
  );
}

function Back() {
  return <Link to="/grades" className="back-link"><ArrowLeft size={18} /> Успеваемость</Link>;
}

function Simulator({ d }: { d: any }) {
  const [wide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const open = useMemo(() => d.points.filter((p: any) => p.score == null), [d]);
  const initial = useMemo(() => Object.fromEntries(open.map((p: any) => [p.id, Math.round(p.max * Math.max(0.4, d.pace))])), [open, d.pace]);
  const [vals, setVals] = useState<Record<number, number>>(initial);
  useEffect(() => setVals(initial), [initial]);
  const semOpen = open.filter((p: any) => !p.final);
  const semPlanned = d.earned + semOpen.reduce((s: number, p: any) => s + (vals[p.id] ?? 0), 0);
  const total = Math.round((d.earned + open.reduce((s: number, p: any) => s + (vals[p.id] ?? 0), 0)) * 10) / 10;
  const g = gradeFor(total, d.control);
  const admitted = semPlanned >= ADMISSION_MIN;
  const openMax = open.reduce((s: number, p: any) => s + p.max, 0);
  const goals = (d.control === 'zachet' ? [['зачёт', THRESHOLDS.pass]] : [['хорошо', THRESHOLDS.good], ['отлично', THRESHOLDS.excellent]]) as [string, number][];
  const goalText = goals.map(([name, th]) => {
    const need = Math.ceil(((th - d.earned) / Math.max(1, openMax)) * 100);
    return need <= 0 ? `«${name}» уже обеспечен(о)` : need > 100 ? `на «${name}» баллов уже не хватит` : `для «${name}» — в среднем ${need}% в каждой оставшейся работе`;
  });

  return (
    <details className="panel acc sim" open={wide}>
      <summary><b>Калькулятор итоговой оценки</b><span className="faint" style={{ color: TONE_COLOR[g.tone] }}>{g.label}</span><ChevronDown size={18} className="acc-chev" /></summary>
      <div className="sim-in">
      {open.length === 0 ? <p className="faint">Все работы оценены.</p> : (
        <div className="stack" style={{ gap: 14 }}>
          {open.map((p: any) => (
            <label key={p.id} className="sim-row">
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span className="ellipsis" style={{ fontSize: 14, fontWeight: 600 }}>{p.title}</span>
                <span className="mono" style={{ fontSize: 13, flex: 'none' }}>{vals[p.id] ?? 0} / {p.max}</span>
              </span>
              <input type="range" className="range" min={0} max={p.max} value={vals[p.id] ?? 0} onChange={(e) => setVals({ ...vals, [p.id]: Number(e.target.value) })} style={{ ['--p' as any]: `${((vals[p.id] ?? 0) / p.max) * 100}%` }} aria-label={`${p.title}, баллы`} />
            </label>
          ))}
        </div>
      )}
      <div className="sim-out">
        <Ring value={Math.round(total)} size={88} stroke={9} color={TONE_COLOR[g.tone]} label={`Итог ${total} баллов`} />
        <div className="sim-res">
          <div className="grade-word" style={{ color: TONE_COLOR[g.tone] }}>{g.label}</div>
          <div className={`chip ${admitted ? 'tone-top' : 'tone-bad'}`} style={{ marginTop: 8 }}>{admitted ? 'допуск есть' : `до допуска ${Math.ceil(ADMISSION_MIN - semPlanned)} б.`}</div>
        </div>
      </div>
      {openMax > 0 && (
        <p className="faint" style={{ fontSize: 13.5, marginTop: 14 }}>
          {goalText.join('; ').replace(/^./, (c) => c.toUpperCase())}.
        </p>
      )}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setVals(initial)}>Сбросить к прогнозу</button>
      </div>
    </details>
  );
}
