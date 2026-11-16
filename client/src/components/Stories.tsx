import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, Megaphone, X } from 'lucide-react';
import { api } from '../lib/api';
import { ago } from '../lib/format';

type Story = { id: number; title: string; body: string; link?: string | null; important: boolean; author: string; created_at: string; read: boolean };
const TONES = ['brand', 'blue', 'ok', 'violet', 'warn'];

/** Лента «историй» деканата, как в мобильном банке: короткие карточки + полноэкранный просмотр. */
export function Stories({ items }: { items: Story[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items?.length) return null;
  return (
    <section className="stories-wrap" aria-label="Новости деканата">
      <div className="stories hscroll">
        {items.map((s, i) => (
          <button key={s.id} className={`story st-${TONES[i % TONES.length]} ${s.read ? 'is-read' : ''}`} onClick={() => setOpen(i)}>
            <span className="story-ico"><Megaphone size={16} /></span>
            <span className="story-title">{s.title}</span>
            {s.important && <span className="story-hot">важно</span>}
          </button>
        ))}
      </div>
      {open !== null && <StoryViewer items={items} start={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function StoryViewer({ items, start, onClose }: { items: Story[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const qc = useQueryClient();
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<number>());
  const s = items[i];
  const go = useCallback((d: number) => setI((x) => { const n = x + d; if (n < 0) return 0; if (n >= items.length) { onClose(); return x; } return n; }), [items.length, onClose]);

  useEffect(() => {
    if (!s || s.read || seen.current.has(s.id)) return;
    seen.current.add(s.id);
    api('/notifications/read', { method: 'POST', body: { ids: [s.id] } }).catch(() => {});
  }, [s]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('.sv-close')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.();
      if (seen.current.size) { qc.invalidateQueries({ queryKey: ['home'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); }
    };
  }, [go, onClose, qc]);
  if (!s) return null;
  return (
    <div className="sv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sv st-${TONES[i % TONES.length]}`} role="dialog" aria-modal="true" aria-label={`Новость ${i + 1} из ${items.length}`} ref={ref}>
        <div className="sv-bars" aria-hidden="true">{items.map((x, k) => <span key={x.id} className={k < i ? 'done' : k === i ? 'cur' : ''} />)}</div>
        <div className="sv-top">
          <span className="story-ico"><Megaphone size={16} /></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b className="ellipsis" style={{ display: 'block', fontSize: 14 }}>{s.author}</b>
            <span className="sv-time">{ago(s.created_at)}</span>
          </span>
          <button className="icon-btn sv-close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
        </div>
        <div className="sv-body" aria-live="polite">
          {s.important && <span className="chip tone-urgent">важно</span>}
          <h2 className="sv-title">{s.title}</h2>
          <p>{s.body}</p>
        </div>
        <div className="sv-foot">
          <button className="icon-btn sv-nav" onClick={() => go(-1)} disabled={i === 0} aria-label="Предыдущая"><ChevronLeft size={22} /></button>
          {s.link ? <button className="btn btn-sm sv-more" onClick={() => { onClose(); nav(s.link!); }}>Подробнее <ArrowRight size={16} /></button> : <span className="sv-count">{i + 1} / {items.length}</span>}
          <button className="icon-btn sv-nav" onClick={() => go(1)} aria-label={i === items.length - 1 ? 'Закрыть' : 'Следующая'}><ChevronRight size={22} /></button>
        </div>
      </div>
    </div>
  );
}
