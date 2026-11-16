import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, SearchX } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Empty, ErrorBox, PageSkeleton, Panel, StatusChip, useToast } from '../components/ui';
import { StepBar } from '../components/Track';
import { dateTime } from '../lib/format';
import { useTitle } from '../lib/hooks';
import { STATUS_LABEL, type Status } from '../../../shared/requests';

const ACTION_LABEL: Partial<Record<Status, string>> = { review: 'Взять в работу', preparing: 'Готовится', ready: 'Готово', done: 'Выдано', needs_info: 'Запросить уточнение', rejected: 'Отклонить' };
const TEMPLATES = ['Документ готов, можно забрать в деканате.', 'Уточните, пожалуйста, данные в заявке.', 'Передали на подпись, обычно это 1–2 дня.'];

export function StaffRequest() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery<any>({ queryKey: ['staff-request', id], queryFn: () => api(`/staff/requests/${id}`) });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useTitle(q.data ? `${q.data.number}` : 'Заявка');

  if (q.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (q.error) return <div className="page"><Back />{(q.error as ApiError).status === 404 ? <Panel><Empty icon={<SearchX size={24} />} title="Заявка не найдена" /></Panel> : <ErrorBox error={q.error} retry={q.refetch} />}</div>;
  const r = q.data;

  const go = async (status: Status) => {
    setBusy(status); setErr('');
    try {
      await api(`/staff/requests/${id}/status`, { method: 'POST', body: { status, comment: comment || undefined } });
      setComment('');
      toast(`Статус: ${STATUS_LABEL[status]}. Студент получил уведомление.`);
      await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ['staff-req'] }), qc.invalidateQueries({ queryKey: ['staff-stats'] })]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="page">
      <Back />
      <div className="page-head">
        <div>
          <h1 className="h1">{r.title}</h1>
          <p className="page-sub">{r.number} · {dateTime(r.created_at)}</p>
        </div>
        <StatusChip status={r.status} />
      </div>
      <div className="req-detail staff-detail">
        <div className="grid" style={{ gap: 18, alignContent: 'start' }}>
          <Panel title="Изменить статус">
            <div style={{ marginBottom: 14 }}><StepBar status={r.status} events={r.events} /></div>
            {r.allowed.length === 0 ? <p className="faint">Заявка закрыта, менять статус больше не нужно.</p> : (
              <>
                <textarea className="textarea" placeholder="Комментарий студенту (обязателен для уточнения и отказа)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} aria-label="Комментарий студенту" />
                <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                  {TEMPLATES.map((t) => <button key={t} type="button" className="chip chip-tpl" onClick={() => setComment(t)} title={t}>{t}</button>)}
                </div>
                {err && <div className="error-box" role="alert" style={{ marginTop: 12 }}>{err}</div>}
                <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
                  {r.allowed.map((s: Status) => (
                    <button key={s} className={`btn btn-sm ${s === 'rejected' ? 'btn-danger' : s === 'needs_info' ? 'btn-ghost' : 'btn-primary'}`} disabled={!!busy} onClick={() => go(s)}>
                      {busy === s ? '…' : ACTION_LABEL[s] ?? STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Panel>
          <Panel title="История и сообщения">
            <ol className="thread">
              {r.events.map((e: any, i: number) => (
                <li key={i} className={e.actor_role === 'staff' ? 'me' : ''}>
                  <span className="staff-av">{e.actor_role === 'staff' ? (e.actor_name ?? 'Д').split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('') : `${r.last_name[0]}${r.first_name[0]}`}</span>
                  <div className="bubble">
                    <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                      <b style={{ fontSize: 13.5 }}>{e.actor_role === 'student' ? `${r.last_name} ${r.first_name[0]}.` : e.actor_name}</b>
                      <span className="faint mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{dateTime(e.created_at)}</span>
                    </div>
                    <div className="faint" style={{ fontSize: 12.5 }}>→ {STATUS_LABEL[e.status as Status].toLowerCase()}</div>
                    {e.comment && <p style={{ marginTop: 6 }}>{e.comment}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
          <Panel title="Студент и заявка">
            <dl className="kv">
              <dt>ФИО</dt><dd>{r.last_name} {r.first_name} {r.middle_name}</dd>
              <dt>Группа</dt><dd>{r.group_name}, {r.course} курс · {r.study_form}, {r.funding.toLowerCase()}</dd>
              <dt>Направление</dt><dd>{r.program_code} {r.program_name}</dd>
              {(r.typeDef?.fields ?? []).filter((f: any) => r.payload[f.name] !== undefined && r.payload[f.name] !== '').map((f: any) => <Fragment key={f.name}><dt>{f.label}</dt><dd>{String(r.payload[f.name])}</dd></Fragment>)}
              <dt>Срок</dt><dd>{r.due_at ? dateTime(r.due_at) : '—'}</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Back() { return <Link to="/staff" className="back-link"><ArrowLeft size={18} /> Заявки студентов</Link>; }
