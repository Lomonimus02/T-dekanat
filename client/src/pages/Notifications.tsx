import type React from "react";
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, CalendarDays, CheckCheck, FileText, Megaphone, Hourglass } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, ErrorBox, PageSkeleton, Panel } from '../components/ui';
import { ago, dayShort, humanDate, relDays } from '../lib/format';
import { useTitle } from '../lib/hooks';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'news', label: 'Новости' },
  { id: 'change', label: 'Расписание' },
  { id: 'request', label: 'Заявки' },
  { id: 'deadline', label: 'Дедлайны' },
] as const;
const ICON: Record<string, React.ReactElement> = { news: <Megaphone size={18} />, change: <CalendarDays size={18} />, request: <FileText size={18} />, deadline: <Hourglass size={18} />, system: <Megaphone size={18} /> };

export function NotificationsPage() {
  useTitle('Уведомления');
  const qc = useQueryClient();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [more, setMore] = useState(false);
  const [f, setF] = useState<(typeof FILTERS)[number]['id']>(sp.get('f') === 'deadline' ? 'deadline' : 'all');
  const q = useQuery<any>({ queryKey: ['notifications'], queryFn: () => api('/notifications') });
  if (q.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (q.error) return <div className="page"><ErrorBox error={q.error} retry={q.refetch} /></div>;
  const allItems = q.data.items.filter((n: any) => f === 'all' || n.kind === f);
  const items = more ? allItems : allItems.slice(0, 8);
  const unread = q.data.items.filter((n: any) => !n.read).length;

  const mark = async (body: object) => {
    await api('/notifications/read', { method: 'POST', body }).catch(() => {});
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['home'] });
  };
  const open = (n: any) => { if (!n.read) mark({ ids: [n.id] }); if (n.link) nav(n.link); };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Уведомления</h1>
          <p className="page-sub">{unread ? `${unread} непрочитанных` : 'Всё прочитано'}</p>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={!unread} onClick={() => mark({ all: true })}><CheckCheck size={16} /> Прочитать все</button>
      </div>

      <div className="filter-chips hscroll" style={{ marginBottom: 12 }} role="group" aria-label="Фильтр">
        {FILTERS.map((x) => <button key={x.id} className={f === x.id ? 'on' : ''} aria-pressed={f === x.id} onClick={() => setF(x.id)}>{x.label}{x.id === 'deadline' && q.data.reminders.length ? ` · ${q.data.reminders.length}` : ''}</button>)}
      </div>
      {f === 'deadline' ? (
        <div className="panel list-card">
          {q.data.reminders.length === 0 ? <p className="faint" style={{ padding: '14px 0' }}>Ближайших дедлайнов нет.</p> : q.data.reminders.map((r: any) => (
            <Link key={r.id} to={`/grades/${r.disciplineId}`} className="rq-row">
              <span className="rq-main"><b className="ellipsis">{r.title}</b><span className="faint ellipsis">{r.discipline}</span></span>
              <span className={`chip chip-xs ${r.days <= 2 ? 'tone-urgent' : 'tone-info'}`}>{relDays(r.days)} · {dayShort(r.date)}, {humanDate(r.date)}</span>
            </Link>
          ))}
        </div>
      ) : (
      <Panel className="feed-panel">
        {items.length === 0 ? <Empty icon={<BellOff size={24} />} title="Здесь пока пусто" text="Как только деканат что-то опубликует или изменится расписание, уведомление появится здесь." /> : (
          <ul className="feed">
            {items.map((n: any) => (
              <li key={n.id}>
                <button className={`feed-item ${n.read ? '' : 'is-unread'} kind-${n.kind}`} onClick={() => open(n)}>
                  <span className="feed-ico">{ICON[n.kind]}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="row feed-head" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <b className="feed-title">{n.title}</b>
                      <span className="faint mono feed-time">{ago(n.created_at)}</span>
                    </span>
                    <span className="feed-body clamp2">{n.body}</span>
                    <span className="feed-meta">
                      {n.important && <span className="chip chip-xs tone-urgent">важно</span>}
                      {n.personal && <span className="chip chip-xs tone-info">лично вам</span>}
                      <span className="faint ellipsis">{n.author}</span>
                    </span>
                  </span>
                  {!n.read && <span className="unread-dot" aria-label="не прочитано" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!more && allItems.length > 8 && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setMore(true)}>Показать ещё {allItems.length - 8}</button>}
      </Panel>
      )}
    </div>
  );
}
