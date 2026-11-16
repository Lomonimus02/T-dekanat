import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, CornerDownLeft, FileText, ChartNoAxesColumn, Bell, User, LayoutGrid, Navigation2, X, Download } from 'lucide-react';
import { api } from '../lib/api';
import { Dialog } from './ui';
import { REQUEST_TYPES } from '../../../shared/requests';

type Answer = { text: string; links: { label: string; to: string }[] };

const PAGES = [
  { to: '/', label: 'Главная', icon: <LayoutGrid size={17} />, words: 'главная неделя дедлайны дисциплины сводка новости' },
  { to: '/schedule', label: 'Расписание на неделю', icon: <CalendarDays size={17} />, words: 'расписание пары занятия неделя аудитория' },
  { to: '/schedule?tab=session', label: 'Сессия и экзамены', icon: <CalendarDays size={17} />, words: 'сессия экзамены консультации' },
  { to: '/grades', label: 'Успеваемость и прогноз', icon: <ChartNoAxesColumn size={17} />, words: 'оценки баллы успеваемость рейтинг стипендия' },
  { to: '/grades?tab=book', label: 'Зачётная книжка', icon: <ChartNoAxesColumn size={17} />, words: 'зачетка зачётная книжка прошлые семестры' },
  { to: '/requests', label: 'Мои заявки и справки', icon: <FileText size={17} />, words: 'заявки справки статус документы' },
  { to: '/notifications', label: 'Уведомления и объявления', icon: <Bell size={17} />, words: 'уведомления новости объявления' },
  { to: '/profile', label: 'Профиль и активные сеансы', icon: <User size={17} />, words: 'профиль сеансы безопасность выход' },
  ...REQUEST_TYPES.map((t) => ({ to: `/requests/new/${t.id}`, label: `Оформить: ${t.title}`, icon: <FileText size={17} />, words: `${t.title} ${t.short} заказать подать` })),
];

export function Navigator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const sug = useQuery<{ suggestions: string[] }>({ queryKey: ['assistant'], queryFn: () => api('/assistant'), enabled: open, staleTime: Infinity });
  const ask = useMutation({ mutationFn: (text: string) => api<Answer>('/assistant', { method: 'POST', body: { q: text } }), onSuccess: setAnswer });

  useEffect(() => { if (!open) { setQ(''); setAnswer(null); ask.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/ё/g, 'е');
    if (!s) return PAGES.slice(0, 5);
    const terms = s.split(/[\s,.?!]+/).filter((x) => x.length > 2).map((x) => x.slice(0, Math.max(3, x.length - 2)));
    return PAGES.filter((p) => (p.label + ' ' + p.words).toLowerCase().replace(/ё/g, 'е').split(/[\s:«»,]+/).some((w) => terms.some((x) => w.startsWith(x)))).slice(0, 5);
  }, [q]);

  const go = (to: string) => { onClose(); nav(to); };
  const submit = (text: string) => { if (text.trim()) { setQ(text); ask.mutate(text); } };

  return (
    <Dialog open={open} onClose={onClose} label="Поиск">
      <form onSubmit={(e) => { e.preventDefault(); submit(q); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 14px 18px', borderBottom: '1px solid var(--line)' }}>
        <Navigation2 size={18} style={{ flex: 'none' }} />
        <input
          className="input" style={{ border: 0, background: 'transparent', padding: 0, height: 40 }}
          placeholder="Куда перейти или что спросить?" value={q} onChange={(e) => { setQ(e.target.value); setAnswer(null); }}
          aria-label="Поиск по кабинету и вопрос помощнику" autoComplete="off" maxLength={300}
        />
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
      </form>
      <div style={{ overflowY: 'auto', padding: 10 }}>
        {(answer || ask.isPending || ask.isError) && (
          <div className="nav-answer" aria-live="polite">
            <div className="label" style={{ marginBottom: 8 }}>Ответ по вашим данным</div>
            {ask.isPending && <div className="faint">Считаю…</div>}
            {ask.isError && <div style={{ color: 'var(--red)' }}>{(ask.error as Error).message}</div>}
            {answer && <div style={{ whiteSpace: 'pre-line', fontSize: 15 }}>{answer.text}</div>}
            {answer && answer.links.length > 0 && (
              <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
                {answer.links.map((l) => <button key={l.to + l.label} className="btn btn-ghost btn-sm" onClick={() => go(l.to)}>{l.label} <ArrowRight size={14} /></button>)}
              </div>
            )}
          </div>
        )}
        {matches.length > 0 && <div className="label" style={{ padding: '6px 10px' }}>Перейти</div>}
        {matches.map((p) => (
          <button key={p.to} className="nav-item" style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }} onClick={() => go(p.to)}>
            {p.icon}<span className="ellipsis">{p.label}</span><ArrowRight size={15} style={{ marginLeft: 'auto' }} className="faint" />
          </button>
        ))}
        {q.trim() && !answer && !ask.isPending && (
          <button className="nav-item" style={{ width: '100%', border: 0, background: 'var(--panel-2)', cursor: 'pointer', textAlign: 'left', marginTop: 6 }} onClick={() => submit(q)}>
            <Navigation2 size={17} /><span className="ellipsis">Спросить помощника: «{q.trim()}»</span><CornerDownLeft size={15} style={{ marginLeft: 'auto' }} className="faint" />
          </button>
        )}
        {!q.trim() && (
          <>
            <div className="label" style={{ padding: '14px 10px 8px' }}>Спросить</div>
            <div className="row wrap" style={{ gap: 8, padding: '0 8px 8px' }}>
              {(sug.data?.suggestions ?? []).map((s) => <button key={s} className="chip" style={{ cursor: 'pointer', height: 32 }} onClick={() => submit(s)}>{s}</button>)}
            </div>
            <div className="row" style={{ padding: '10px 10px 6px', gap: 8 }}>
              <Download size={14} className="faint" />
              <a className="link" style={{ fontSize: 13.5 }} href="/dekanat/api/schedule.ics">Скачать расписание в календарь (.ics)</a>
            </div>
          </>
        )}
        <p className="faint" style={{ fontSize: 12, padding: '10px 10px 6px' }}>Помощник работает на сервере кабинета по правилам и видит только ваши данные. Внешние ИИ-сервисы не используются.</p>
      </div>
    </Dialog>
  );
}
