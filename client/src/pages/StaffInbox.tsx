import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Hourglass, ArrowRight, Inbox, Search } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, ErrorBox, Panel, Skeleton, StatusChip } from '../components/ui';
import { ago } from '../lib/format';
import { useTitle } from '../lib/hooks';
import { STATUS_LABEL, type Status } from '../../../shared/requests';

const TABS: { id: string; label: string }[] = [
  { id: 'active', label: 'В работе' }, { id: 'submitted', label: 'Новые' }, { id: 'review', label: 'На проверке' }, { id: 'preparing', label: 'Готовятся' },
  { id: 'needs_info', label: 'Уточнение' }, { id: 'ready', label: 'Готово' }, { id: 'all', label: 'Все' },
];

export function StaffInbox() {
  useTitle('Заявки студентов');
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  const me = useQuery<any>({ queryKey: ['staff-me'], queryFn: () => api('/staff/me') });
  const stats = useQuery<any>({ queryKey: ['staff-stats'], queryFn: () => api('/staff/stats'), refetchInterval: 30_000 });
  const list = useQuery<any[]>({ queryKey: ['staff-req', tab, search], queryFn: () => api(`/staff/requests?status=${tab}&q=${encodeURIComponent(search)}`), placeholderData: keepPreviousData, refetchInterval: 30_000 });
  const by = stats.data?.byStatus ?? {};

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Заявки студентов</h1>
          <p className="page-sub">Учебный офис · {me.data ? `${me.data.last_name} ${me.data.first_name}` : '…'}{stats.data?.overdue ? <> · <span style={{ color: 'var(--red)' }}>просрочено {stats.data.overdue}</span></> : null}</p>
        </div>
      </div>
      <Panel className="inbox">
        <div className="inbox-tools">
          <div className="filter-chips hscroll">{TABS.map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}{by[t.id] ? <span className={`chip-n ${t.id === 'needs_info' ? 'is-red' : ''}`}>{by[t.id]}</span> : null}</button>)}</div>
          <label className="search">
            <Search size={16} className="faint" />
            <input placeholder="Номер, фамилия, группа" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск заявок" />
          </label>
        </div>
        {list.isLoading ? <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={64} r={14} />)}</div>
          : list.error ? <ErrorBox error={list.error} retry={list.refetch} />
          : list.data!.length === 0 ? <Empty icon={<Inbox size={24} />} title="Заявок нет" text={search ? 'Ничего не нашлось — проверьте запрос.' : `В статусе «${TABS.find((t) => t.id === tab)?.label}» пусто.`} />
          : (
            <ul className="inbox-list">
              {list.data!.map((r) => (
                <li key={r.id}>
                  <Link to={`/staff/requests/${r.id}`} className="inbox-row">
                    <span className="mono faint ir-no">{r.number}</span>
                    <span className="ir-main">
                      <b className="ellipsis" style={{ display: 'block' }}>{r.title}</b>
                      <span className="faint ellipsis" style={{ display: 'block', fontSize: 13 }}>{r.student} · {r.group_name} · {r.faculty}</span>
                    </span>
                    <span className="ir-meta">
                      {r.overdue && <span className="chip tone-bad" title="Срок прошёл"><Hourglass size={13} />срок</span>}
                      <StatusChip status={r.status as Status} />
                      <span className="faint ir-ago">{ago(r.created_at)}</span>
                    </span>
                    <ArrowRight size={16} className="faint ir-arrow" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </Panel>
    </div>
  );
}
