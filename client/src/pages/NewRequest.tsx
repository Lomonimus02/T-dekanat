import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Minus, Plus, Send, UserCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { ErrorBox, PageSkeleton, Panel, useToast } from '../components/ui';
import { Catalog } from '../components/Catalog';
import { typeById, type FieldDef } from '../../../shared/requests';
import { addDays, ymd } from '../lib/format';
import { useTitle } from '../lib/hooks';

export function NewRequestPage() {
  const { type } = useParams();
  const t = type ? typeById(type) : undefined;
  useTitle(t ? t.title : 'Новая заявка');
  if (!t) {
    return (
      <div className="page">
        <Link to="/requests" className="back-link"><ArrowLeft size={18} /> Заявки и справки</Link>
        <div className="page-head"><div><h1 className="h1">Новая заявка</h1><p className="page-sub">Форма заполнится данными из профиля</p></div></div>
        <Catalog />
      </div>
    );
  }
  return <Form key={t.id} typeId={t.id} />;
}

function Form({ typeId }: { typeId: string }) {
  const t = typeById(typeId)!;
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const cat = useQuery<any>({ queryKey: ['catalog'], queryFn: () => api('/catalog') });
  const prof = useQuery<any>({ queryKey: ['profile'], queryFn: () => api('/me/profile') });
  const defaults = useMemo(() => Object.fromEntries(t.fields.map((f) => [f.name, f.type === 'number' ? f.min : f.type === 'select' ? f.options[0] : f.type === 'date' ? addDays(ymd(new Date()), 7) : ''])), [t]);
  const [vals, setVals] = useState<Record<string, string | number>>(defaults);
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  if (cat.isLoading || prof.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (cat.error) return <div className="page"><ErrorBox error={cat.error} retry={cat.refetch} /></div>;
  const discOptions: string[] = cat.data.disciplines;
  const debts: string[] = cat.data.debts;
  const v = (f: FieldDef) => (f.type === 'discipline' && !vals[f.name] ? (debts[0] ?? discOptions[0] ?? '') : vals[f.name]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const fields = Object.fromEntries(t.fields.map((f) => [f.name, v(f)]));
      const r = await api<{ id: string; number: string }>('/requests', { method: 'POST', body: { type: t.id, fields } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['requests'] }), qc.invalidateQueries({ queryKey: ['home'] })]);
      toast(`Заявка ${r.number} отправлена`);
      nav(`/requests/${r.id}`, { replace: true });
    } catch (e) {
      setErr({ msg: e instanceof ApiError ? e.message : 'Не удалось отправить', field: e instanceof ApiError ? e.field : undefined });
    } finally { setBusy(false); }
  };

  const p = prof.data;
  return (
    <div className="page">
      <Link to="/requests/new" className="back-link"><ArrowLeft size={18} /> Новая заявка</Link>
      <div className="page-head">
        <div>
          <h1 className="h1">{t.title}</h1>
          <p className="page-sub">{t.short} · срок {t.eta}{t.electronic ? ', есть электронная' : ''}</p>
        </div>
      </div>
      <div className="form-layout">
        <Panel>
          <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            {t.fields.map((f) => (
              <div key={f.name} className="field">
                <span>{f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}</span>
                {f.type === 'select' && (
                  f.options.length <= 6 ? (
                    <div className="choice-grid" role="radiogroup" aria-label={f.label}>
                      {f.options.map((o) => (
                        <button type="button" key={o} role="radio" aria-checked={v(f) === o} className={`choice ${v(f) === o ? 'on' : ''}`} onClick={() => setVals({ ...vals, [f.name]: o })}>{o}</button>
                      ))}
                    </div>
                  ) : (
                    <select className="select" value={String(v(f))} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
                  )
                )}
                {f.type === 'discipline' && (
                  <select className="select" value={String(v(f))} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} aria-invalid={err?.field === f.name}>
                    {debts.length > 0 && <optgroup label="Задолженности">{debts.map((o) => <option key={'d' + o} value={o}>{o}</option>)}</optgroup>}
                    <optgroup label="Текущий семестр">{discOptions.filter((o) => !debts.includes(o)).map((o) => <option key={o}>{o}</option>)}</optgroup>
                  </select>
                )}
                {f.type === 'number' && (
                  <div className="stepper">
                    <button type="button" aria-label="Меньше" disabled={Number(v(f)) <= f.min} onClick={() => setVals({ ...vals, [f.name]: Number(v(f)) - 1 })}><Minus size={16} /></button>
                    <output aria-live="polite">{v(f)}</output>
                    <button type="button" aria-label="Больше" disabled={Number(v(f)) >= f.max} onClick={() => setVals({ ...vals, [f.name]: Number(v(f)) + 1 })}><Plus size={16} /></button>
                  </div>
                )}
                {f.type === 'text' && <input className="input" value={String(v(f))} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} aria-invalid={err?.field === f.name} />}
                {f.type === 'textarea' && <textarea className="textarea" value={String(v(f))} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} aria-invalid={err?.field === f.name} />}
                {f.type === 'date' && <input className="input" type="date" value={String(v(f))} min={ymd(new Date())} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} aria-invalid={err?.field === f.name} />}
              </div>
            ))}
            {err && <div className="error-box" role="alert">{err.msg}</div>}
            <button className="btn btn-primary btn-block form-submit" disabled={busy} style={{ height: 50 }}>{busy ? 'Отправляем…' : <><Send size={17} /> Отправить в деканат</>}</button>
          </form>
        </Panel>
        <details className="panel acc" open={wide}>
          <summary><UserCheck size={18} /><b>Данные из профиля и сроки</b><ChevronDown size={18} className="acc-chev" /></summary>
          <dl className="kv" style={{ marginTop: 6 }}>
            <dt>ФИО</dt><dd>{p.lastName} {p.firstName} {p.middleName}</dd>
            <dt>Группа</dt><dd>{p.group}, {p.course} курс</dd>
            <dt>Направление</dt><dd>{p.programCode} {p.program}</dd>
            <dt>Форма</dt><dd>{p.studyForm}, {p.funding.toLowerCase()}</dd>
          </dl>
          <p className="faint" style={{ fontSize: 13, padding: '10px 0 14px' }}>
            {t.electronic ? 'Электронная справка придёт в кабинет с QR-кодом для проверки подлинности. ' : ''}
            О каждом шаге придёт уведомление. Бумажные документы — в деканате, {cat.data.deanOffice.room} ({cat.data.deanOffice.hours}).
          </p>
        </details>
      </div>
    </div>
  );
}
