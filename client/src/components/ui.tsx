import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CircleCheck, Info, RotateCcw } from 'lucide-react';
import { STATUS_LABEL, type Status } from '../../../shared/requests';

export function LogoMark({ size = 34 }: { size?: number }) {
  // Собственный знак: жёлтый скруглённый квадрат, чёрная «галочка-крыша» (рост) и точка.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <rect width="64" height="64" rx="18" fill="#ffdd2d" />
      <path d="M17 37L32 23L47 37" fill="none" stroke="#16171a" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="46" r="5" fill="#16171a" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <LogoMark size={compact ? 30 : 36} />
      <span className="brand-word">Stellar{!compact && <small>Деканат · концепт</small>}</span>
    </span>
  );
}

export function Panel({ title, idx, action, children, className = '', id }: { title?: ReactNode; idx?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${className}`} id={id} aria-labelledby={id ? `${id}-t` : undefined}>
      {(title || action) && (
        <div className="panel-head">
          <div className="panel-title">
            {idx && <span className="idx">{idx}</span>}
            {title && <h2 className="h2" id={id ? `${id}-t` : undefined}>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 16, style }: { h?: number; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="grid" aria-busy="true" aria-label="Загрузка">
      <Skeleton h={34} w="45%" />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Skeleton h={180} />
        <Skeleton h={180} />
      </div>
      <Skeleton h={260} />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="glyph">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Не удалось загрузить данные';
  return (
    <div className="error-box" role="alert">
      <AlertTriangle size={18} style={{ flex: 'none', marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{msg}</div>
        {retry && <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={retry}><RotateCcw size={14} /> Повторить</button>}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<Status, string> = { submitted: 'tone-info', review: 'tone-good', preparing: 'tone-warn', needs_info: 'tone-urgent', ready: 'tone-top', done: 'tone-muted', rejected: 'tone-muted' };
export function StatusChip({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_TONE[status]}`}><span className="pip" />{STATUS_LABEL[status]}</span>;
}

export function Avatar({ first, last, size = 40 }: { first?: string; last?: string; hue?: number; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {(last?.[0] ?? '') + (first?.[0] ?? '')}
    </span>
  );
}

type Toast = { id: number; text: string; tone: 'ok' | 'info' | 'error' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {list.map((t) => (
          <div className="toast" key={t.id}>
            {t.tone === 'ok' ? <CircleCheck size={18} /> : t.tone === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Dialog({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input, textarea, button')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={label} ref={ref}>{children}</div>
    </div>
  );
}

export function Progress({ value, max = 100, tone = 'var(--ink)', h = 6 }: { value: number; max?: number; tone?: string; h?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="progress" style={{ height: h }} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div style={{ width: `${pct}%`, background: tone }} />
    </div>
  );
}

export const STATE_COLOR: Record<string, string> = { ok: 'var(--ok)', attention: 'var(--warn)', risk: 'var(--red)' };
export const STATE_LABEL: Record<string, string> = { ok: 'в графике', attention: 'внимание', risk: 'риск' };
export const TONE_COLOR: Record<string, string> = { top: 'var(--ok)', good: 'var(--blue)', ok: 'var(--warn)', bad: 'var(--red)' };
