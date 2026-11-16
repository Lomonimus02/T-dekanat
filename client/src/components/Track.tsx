import { Check, MessageSquareWarning, X } from 'lucide-react';
import { STATUS_FLOW, STATUS_LABEL, type Status } from '../../../shared/requests';
import { dateTime } from '../lib/format';

/** Трекер заявки, как у доставки: шаги и время каждого */
export function Track({ status, events }: { status: Status; events: { status: Status; created_at: string }[] }) {
  const reached = (s: Status) => events.find((e) => e.status === s);
  const curIdx = status === 'needs_info' ? STATUS_FLOW.indexOf((events.filter((e) => STATUS_FLOW.includes(e.status as any)).at(-1)?.status ?? 'submitted') as any)
    : status === 'rejected' ? -1 : STATUS_FLOW.indexOf(status as any);
  if (status === 'rejected') {
    return (
      <div className="track is-rejected">
        <div className="tr-step done"><span className="tr-dot"><Check size={13} /></span><div><b>Отправлена</b><span>{reached('submitted') ? dateTime(reached('submitted')!.created_at) : ''}</span></div></div>
        <div className="tr-step bad"><span className="tr-dot"><X size={13} /></span><div><b>Отклонена</b><span>{reached('rejected') ? dateTime(reached('rejected')!.created_at) : ''}</span></div></div>
      </div>
    );
  }
  return (
    <ol className="track">
      {STATUS_FLOW.map((s, i) => {
        const e = [...events].reverse().find((x) => x.status === s);
        const state = i < curIdx || (i === curIdx && (s === 'done')) ? 'done' : i === curIdx ? 'cur' : 'todo';
        return (
          <li key={s} className={`tr-step ${state}`}>
            <span className="tr-dot">{state === 'done' || (state === 'cur' && s === 'ready') ? <Check size={13} /> : null}</span>
            <div>
              <b>{STATUS_LABEL[s]}</b>
              <span>{e && i <= curIdx ? dateTime(e.created_at) : '—'}</span>
            </div>
          </li>
        );
      })}
      {status === 'needs_info' && <li className="tr-flag"><MessageSquareWarning size={15} /> Деканату нужно уточнение — ответьте ниже</li>}
    </ol>
  );
}

const SHORT: Record<string, string> = { submitted: 'Подана', review: 'Проверка', preparing: 'Готовится', ready: 'Готово', done: 'Выдано' };

/** Компактный трекер: пять сегментов в одну строку, подписи под ними. */
export function StepBar({ status, events }: { status: Status; events: { status: Status; created_at: string }[] }) {
  if (status === 'rejected') return <div className="stepbar-rej"><X size={15} /> Заявка отклонена</div>;
  const curIdx = status === 'needs_info' ? STATUS_FLOW.indexOf((events.filter((e) => STATUS_FLOW.includes(e.status as any)).at(-1)?.status ?? 'submitted') as any) : STATUS_FLOW.indexOf(status as any);
  return (
    <ol className="stepbar" aria-label={`Статус: ${STATUS_LABEL[status]}`}>
      {STATUS_FLOW.map((s, i) => (
        <li key={s} className={i < curIdx || (i === curIdx && (s === 'done' || s === 'ready')) ? 'done' : i === curIdx ? (status === 'needs_info' ? 'warn' : 'cur') : ''}>
          <i /><span>{SHORT[s]}</span>
        </li>
      ))}
    </ol>
  );
}
