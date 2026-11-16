import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, Banknote, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBox, PageSkeleton, STATE_COLOR, STATE_LABEL, TONE_COLOR } from '../components/ui';
import { CONTROL_LABEL, ADMISSION_MIN } from '../../../shared/grading';
import { humanDate, plural, relDays } from '../lib/format';
import { useTitle } from '../lib/hooks';

/** Круговой индикатор со скруглёнными концами и крупной цифрой в центре. */
export function Ring({ value, size = 132, stroke = 12, color = 'var(--ink)', label, track = 'var(--surface-3)' }: { value: number; size?: number; stroke?: number; color?: string; label?: string; track?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${value} из 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring-val"><span className="num" style={{ fontSize: Math.round(size * 0.3) }}>{value}</span><span className="ring-of">из 100</span></span>
    </div>
  );
}

export function GradesPage() {
  useTitle('Успеваемость');
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'book' ? 'book' : 'sem';
  const q = useQuery<any>({ queryKey: ['grades'], queryFn: () => api('/grades') });
  if (q.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (q.error) return <div className="page"><ErrorBox error={q.error} retry={q.refetch} /></div>;
  const { disciplines: ds, overview: ov, recordBook: book, semester } = q.data;
  const sems = [...new Set<number>(book.map((r: any) => r.semester))];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Успеваемость</h1>
          <p className="page-sub">{semester.title}</p>
        </div>
        <div className="seg page-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'sem'} className={tab === 'sem' ? 'on' : ''} onClick={() => setSp({}, { replace: true })}>Этот семестр</button>
          <button role="tab" aria-selected={tab === 'book'} className={tab === 'book' ? 'on' : ''} onClick={() => setSp({ tab: 'book' }, { replace: true })}>Зачётная книжка</button>
        </div>
      </div>

      {tab === 'sem' ? (
        <div className="stack">
          <div className="sum-card card-brand">
            <Ring value={ov.rating} size={76} stroke={8} color="var(--ink)" track="rgba(22,23,26,.12)" label={`Рейтинг семестра ${ov.rating} из 100`} />
            <span className="sum-body">
              <b>Рейтинг семестра</b>
              <span className="row wrap" style={{ gap: 4 }}>
                {ov.counts.top > 0 && <span className="chip chip-xs tone-top">{ov.counts.top} × отл./зачёт</span>}
                {ov.counts.good > 0 && <span className="chip chip-xs tone-good">{ov.counts.good} × хор.</span>}
                {ov.counts.ok > 0 && <span className="chip chip-xs tone-ok">{ov.counts.ok} × удовл.</span>}
                {ov.counts.bad > 0 && <span className="chip chip-xs tone-bad">{ov.counts.bad} × риск</span>}
              </span>
              <span className="sum-stip"><Banknote size={15} /> {ov.stipend.title}</span>
            </span>
          </div>
          {ov.debts.length > 0 && <Link to="/requests/new/retake" className="btn btn-danger btn-block"><AlertOctagon size={16} /> Взять направление на пересдачу</Link>}

          <div className="panel list-card">
            {ds.map((d: any) => (
              <Link to={`/grades/${d.id}`} key={d.id} className="dl-row">
                <span className="dl-main">
                  <b className="dl-name">{d.name}</b>
                  <span className="dl-sub faint">{CONTROL_LABEL[d.control as 'exam']} · {d.next ? `${d.next.title}, ${relDays(d.next.days)}` : 'работы сданы'}</span>
                  <span className="bar-adm" aria-label={`Набрано ${d.earned} из ${d.semMax}, допуск от ${ADMISSION_MIN}`}>
                    <span className="fill" style={{ width: `${(d.earned / d.semMax) * 100}%`, background: STATE_COLOR[d.state] }} />
                    <span className="proj" style={{ width: `${(Math.min(d.semMax, d.projectedSemester) / d.semMax) * 100}%` }} />
                    <span className="mark" style={{ left: `${(ADMISSION_MIN / d.semMax) * 100}%` }} />
                  </span>
                </span>
                <span className="dl-side">
                  <span className="num dl-score">{d.earned}<small>/{d.semMax}</small></span>
                  <span className="dl-grade" style={{ color: TONE_COLOR[d.projectedGrade.tone] }}>{d.state !== 'ok' && <span className={`pip tone-${d.state}`} aria-label={STATE_LABEL[d.state]} />}{d.projectedGrade.label}</span>
                </span>
              </Link>
            ))}
          </div>
          <details className="more-info">
            <summary>Как считаются баллы</summary>
            <p>Полоса — баллы семестра (максимум {ds[0]?.semMax ?? 60}), штриховка — прогноз при текущих результатах, метка — порог допуска {ADMISSION_MIN}. Экзамен или зачёт добавляют до 40 баллов. Справа — прогноз итоговой оценки. {ov.stipend.text}</p>
          </details>
        </div>
      ) : (
        <div className="stack">
          {ov.gpa.length > 0 && (
            <div className="gpa-line" aria-label="Средний балл по семестрам">
              {ov.gpa.map((g: any) => <span key={g.semester} className="gpa-pill"><span className="faint">{g.semester} сем.</span> <b className="num">{g.gpa.toFixed(2)}</b></span>)}
            </div>
          )}
          {sems.length === 0 && <div className="day-empty">Записей пока нет — первая сессия впереди</div>}
          {sems.reverse().map((s, si) => (
            <details key={s} className="panel acc" open={si === 0}>
              <summary><b>{s}-й семестр</b><span className="faint">{book.filter((r: any) => r.semester === s).length} {plural(book.filter((r: any) => r.semester === s).length, 'запись', 'записи', 'записей')}</span><ChevronDown size={18} className="acc-chev" /></summary>
              <div className="book">
                {book.filter((r: any) => r.semester === s).map((r: any, i: number) => {
                  const bad = ['неудовлетворительно', 'не зачтено'].includes(r.result);
                  return (
                    <div key={i} className={`book-row ${bad ? 'is-bad' : ''}`}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{r.discipline}</div>
                        <div className="faint" style={{ fontSize: 12.5 }}>{r.control} · {r.credits} з. е. · {humanDate(r.passed_on)}</div>
                      </div>
                      <div className="book-res">
                        <span className={`chip chip-xs ${bad ? 'tone-bad' : r.result === 'отлично' || r.result === 'зачтено' ? 'tone-top' : r.result === 'хорошо' ? 'tone-good' : 'tone-ok'}`}>{r.result}</span>
                        {r.points != null && <span className="mono faint" style={{ fontSize: 12 }}>{r.points} б.</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
