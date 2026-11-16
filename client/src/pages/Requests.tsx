import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Inbox, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, ErrorBox, Panel, Skeleton, StatusChip } from '../components/ui';
import { ago } from '../lib/format';
import { useTitle } from '../lib/hooks';
import { STATUS_FLOW, STATUS_HINT, type Status } from '../../../shared/requests';

export function RequestsPage() {
  useTitle('Заявки и справки');
  const q = useQuery<any[]>({ queryKey: ['requests'], queryFn: () => api('/requests') });
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const list = (q.data ?? []).filter((r) => (tab === 'active' ? !['done', 'rejected'].includes(r.status) : ['done', 'rejected'].includes(r.status)));
  const activeCount = (q.data ?? []).filter((r) => !['done', 'rejected'].includes(r.status)).length;

  return (
    <div className="page has-fab">
      <div className="page-head">
        <h1 className="h1">Заявки и справки</h1>
        <Link to="/requests/new" className="btn btn-primary fab"><Plus size={20} /> Новая заявка</Link>
      </div>
      <div className="seg page-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>В работе{activeCount ? ` · ${activeCount}` : ''}</button>
        <button role="tab" aria-selected={tab === 'archive'} className={tab === 'archive' ? 'on' : ''} onClick={() => setTab('archive')}>Архив</button>
      </div>
      {q.isLoading ? <div className="stack">{[0, 1].map((i) => <Skeleton key={i} h={72} r={16} />)}</div>
        : q.error ? <ErrorBox error={q.error} retry={q.refetch} />
        : list.length === 0 ? (
          <Panel><Empty icon={<Inbox size={24} />} title={tab === 'active' ? 'Сейчас ничего не в работе' : 'Архив пуст'} text={tab === 'active' ? 'Форма заявки заполняется данными из профиля.' : 'Здесь появятся выданные и закрытые заявки.'} action={tab === 'active' ? <Link to="/requests/new" className="btn btn-ghost btn-sm">Выбрать справку или заявление</Link> : undefined} /></Panel>
        ) : (
          <ul className="panel list-card req-rows">
            {list.map((r) => (
              <li key={r.id}>
                <Link to={`/requests/${r.id}`} className="rq-row">
                  <span className="rq-main">
                    <b className="ellipsis">{r.title}</b>
                    <span className="faint ellipsis">{r.number} · {r.last_comment ?? STATUS_HINT[r.status as Status]}</span>
                  </span>
                  <StatusChip status={r.status as Status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
