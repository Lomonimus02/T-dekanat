import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Megaphone, Plus, Send } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, ErrorBox, Panel, Skeleton, useToast } from '../components/ui';
import { ago } from '../lib/format';
import { useTitle } from '../lib/hooks';

export function StaffAnnouncements() {
  useTitle('Объявления');
  const toast = useToast();
  const aud = useQuery<any>({ queryKey: ['audience'], queryFn: () => api('/staff/audience') });
  const list = useQuery<any[]>({ queryKey: ['ann'], queryFn: () => api('/staff/announcements') });
  const [title, setTitle] = useState('');
  const [wide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [important, setImportant] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    setBusy(true); setErr('');
    try {
      await api('/staff/announcements', { method: 'POST', body: { title, body, audience, important } });
      setTitle(''); setBody(''); setImportant(false);
      toast('Объявление опубликовано — студенты увидят его в уведомлениях');
      list.refetch();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page-head"><h1 className="h1">Объявления</h1></div>
      <div className="req-detail">
        <details className="panel acc ann-form" open={wide}>
          <summary><Plus size={18} /><b>Новое объявление</b><ChevronDown size={18} className="acc-chev" /></summary>
          <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); publish(); }}>
            <label className="field"><span>Заголовок</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
            <label className="field"><span>Текст</span><textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} /></label>
            <label className="field"><span>Кому</span>
              <select className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">Всем студентам</option>
                {aud.data?.faculties.map((f: any) => <option key={f.id} value={`faculty:${f.id}`}>Факультет: {f.name}</option>)}
                {aud.data?.groups.map((g: any) => <option key={g.id} value={`group:${g.id}`}>Группа {g.name}</option>)}
              </select>
            </label>
            <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
              <span>Важное — показать на главной у студентов</span>
            </label>
            {err && <div className="error-box" role="alert">{err}</div>}
            <button className="btn btn-primary" disabled={busy || title.trim().length < 3 || body.trim().length < 3}><Send size={16} /> Опубликовать</button>
          </form>
        </details>
        <Panel title="Опубликованные">
          {list.isLoading ? <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={70} r={14} />)}</div> : list.error ? <ErrorBox error={list.error} /> : list.data!.length === 0 ? <Empty icon={<Megaphone size={24} />} title="Пока нет объявлений" /> : (
            <ul className="feed">
              {list.data!.map((n) => (
                <li key={n.id} className="ann">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <b style={{ minWidth: 0 }}>{n.title}</b>
                    <span className="faint mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{ago(n.created_at)}</span>
                  </div>
                  <p className="muted ellipsis" style={{ fontSize: 13.5, marginTop: 2 }}>{n.body}</p>
                  <div className="feed-meta">
                    {n.important && <span className="chip chip-xs tone-urgent">важно</span>}
                    <span className="faint ellipsis">{n.group_name ? `группа ${n.group_name}` : n.faculty ? n.faculty : 'все студенты'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
