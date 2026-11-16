import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, FileDown, SearchX, Send, Undo2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Avatar, Empty, ErrorBox, PageSkeleton, Panel, StatusChip, useToast } from '../components/ui';
import { StepBar } from '../components/Track';
import { dateTime } from '../lib/format';
import { useTitle } from '../lib/hooks';
import { STATUS_HINT, STATUS_LABEL, type Status } from '../../../shared/requests';

export function RequestPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery<any>({ queryKey: ['request', id], queryFn: () => api(`/requests/${id}`), refetchInterval: 20_000 });
  const prof = useQuery<any>({ queryKey: ['profile'], queryFn: () => api('/me/profile') });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [wide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useTitle(q.data?.title ?? 'Заявка');

  if (q.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (q.error) {
    return (
      <div className="page">
        <BackLink />
        {(q.error as ApiError).status === 404
          ? <Panel><Empty icon={<SearchX size={24} />} title="Заявка не найдена" text="Такой заявки нет среди ваших. Чужие заявки в кабинете не открываются." action={<Link to="/requests" className="btn btn-ghost btn-sm">К моим заявкам</Link>} /></Panel>
          : <ErrorBox error={q.error} retry={q.refetch} />}
      </div>
    );
  }
  const r = q.data;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['request', id] }), qc.invalidateQueries({ queryKey: ['requests'] }), qc.invalidateQueries({ queryKey: ['home'] })]);
  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try { await api(`/requests/${id}/reply`, { method: 'POST', body: { text: reply } }); setReply(''); toast('Ответ отправлен в деканат'); await refresh(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { await api(`/requests/${id}/cancel`, { method: 'POST' }); toast('Заявка отменена', 'info'); await refresh(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const fields = r.type?.fields ?? [];

  return (
    <div className="page">
      <BackLink />
      <div className="page-head">
        <div>
          <h1 className="h1">{r.title}</h1>
          <p className="page-sub">{r.number} · от {dateTime(r.created_at)}</p>
        </div>
        <StatusChip status={r.status as Status} />
      </div>
      <div className="req-detail">
        <div className="stack" style={{ alignContent: 'start' }}>
          <section className="panel">
            <StepBar status={r.status} events={r.events} />
            <p className="req-hint">{r.status === 'ready' && !r.electronic ? 'Документ готов — заберите в деканате, возьмите студенческий билет.' : STATUS_HINT[r.status as Status]}</p>
            {r.status === 'ready' && r.electronic && (
              <Link to={`/requests/${r.id}/document`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}><FileDown size={17} /> Открыть справку с QR</Link>
            )}
            {r.status === 'needs_info' && (
              <div className="reply-box">
                <textarea className="textarea" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ответ деканату, например: подходит 27 ноября" maxLength={1000} aria-label="Ответ деканату" />
                <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy || !reply.trim()} onClick={send}><Send size={16} /> Отправить ответ</button>
              </div>
            )}
          </section>
          <section className="panel">
            <h2 className="h2 sec-h">История и сообщения</h2>
            <ol className="thread">
              {r.events.map((e: any, i: number) => (
                <li key={i} className={e.actor_role === 'student' ? 'me' : ''}>
                  {e.actor_role === 'student' ? <Avatar first={prof.data?.firstName} last={prof.data?.lastName} hue={prof.data?.avatarHue ?? 168} size={30} /> : <span className="staff-av">Д</span>}
                  <div className="bubble">
                    <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                      <b style={{ fontSize: 13.5 }}>{e.actor_role === 'student' ? 'Вы' : e.actor_name}</b>
                      <span className="faint mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{dateTime(e.created_at)}</span>
                    </div>
                    <div className="faint" style={{ fontSize: 12.5 }}>{STATUS_LABEL[e.status as Status]}</div>
                    {e.comment && <p style={{ marginTop: 4 }}>{e.comment}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="stack" style={{ alignContent: 'start' }}>
          <details className="panel acc" open={wide}>
            <summary><b>Данные заявки</b><ChevronDown size={18} className="acc-chev" /></summary>
            <dl className="kv" style={{ padding: '4px 0 12px' }}>
              {fields.filter((f: any) => r.payload[f.name] !== undefined && r.payload[f.name] !== '').map((f: any) => <Fragment key={f.name}><dt>{f.label}</dt><dd>{String(r.payload[f.name])}</dd></Fragment>)}
            </dl>
          </details>
          {r.status === 'submitted' && <button className="btn btn-ghost" disabled={busy} onClick={cancel}><Undo2 size={16} /> Отменить заявку</button>}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return <Link to="/requests" className="back-link"><ArrowLeft size={18} /> Заявки и справки</Link>;
}
