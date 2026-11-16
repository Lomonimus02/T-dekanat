import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Check, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useMe } from '../lib/auth';
import { Brand, LogoMark } from '../components/ui';
import { useTitle } from '../lib/hooks';

const DEMO = [
  { login: 'vetrova', password: 'Orbita-2026', who: 'Мирослава Ветрова', meta: 'ФКН · 2 курс · отличница' },
  { login: 'galeev', password: 'Kometa-2026', who: 'Тимур Галеев', meta: 'ЭФ · 3 курс · есть долг' },
  { login: 'dekanat', password: 'Zvezda-2026', who: 'Ольга Лаврова', meta: 'Сотрудник деканата' },
];

export function LoginPage() {
  useTitle('Вход');
  const me = useMe();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (me.data) return <Navigate to={me.data.role === 'staff' ? '/staff' : '/'} replace />;

  const submit = async (l = login, p = password) => {
    if (!l.trim() || !p) { setError('Введите логин и пароль'); return; }
    setBusy(true); setError('');
    try {
      const r = await api<{ role: string }>('/auth/login', { method: 'POST', body: { login: l.trim(), password: p } });
      await qc.invalidateQueries({ queryKey: ['me'] });
      const from = (loc.state as any)?.from;
      nav(r.role === 'staff' ? '/staff' : from && from !== '/login' ? from : '/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось войти');
    } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <section className="login-art" aria-hidden="true">
        <div className="login-top">
          <span className="brand"><LogoMark size={40} /><span className="brand-word">Stellar<small>Деканат · концепт</small></span></span>
          <span className="login-year">2026/27</span>
        </div>
        <div className="login-copy">
          <h1 className="display">Вся учёба —<br />в одном кабинете</h1>
          <p>Пары, баллы, справки и новости деканата. Кабинет сам подсказывает, что важно на этой неделе.</p>
        </div>
        <div className="login-cards">
          <div className="lc lc-1"><span className="lc-ico lc-ok"><Check size={18} /></span><span><b>Справка готова</b><small>электронная, с QR-кодом</small></span></div>
          <div className="lc lc-2"><span className="lc-label">Рейтинг семестра</span><span className="lc-num">92<small>/100</small></span><span className="lc-bar"><i /></span></div>
          <div className="lc lc-3"><span className="lc-ico lc-blue"><CalendarDays size={18} /></span><span><b>Пара через 15 минут</b><small>ауд. К1-305 · Алгоритмы</small></span></div>
        </div>
      </section>

      <section className="login-form-wrap">
        <div className="login-card">
          <span className="login-brand"><Brand /></span>
          <div>
            <h2 className="h1" style={{ fontSize: 26 }}>Вход в кабинет</h2>
            <p className="muted" style={{ marginTop: 6 }}>Университет «Стеллар» — вымышленный вуз</p>
          </div>
          <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            <label className="field">
              <span>Логин</span>
              <input className="input" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} aria-invalid={!!error} autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="field">
              <span>Пароль</span>
              <div style={{ position: 'relative' }}>
                <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} style={{ paddingRight: 50 }} />
                <button type="button" className="icon-btn" style={{ position: 'absolute', right: 3, top: 3 }} onClick={() => setShow(!show)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && <div className="error-box" role="alert" style={{ padding: '10px 14px' }}>{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} style={{ height: 50 }}>{busy ? 'Проверяем…' : <>Войти <ArrowRight size={18} /></>}</button>
          </form>
          <div className="demo">
            <div className="label">Демо-аккаунты для жюри</div>
            {DEMO.map((d) => (
              <button key={d.login} className="demo-acc" onClick={() => { setLogin(d.login); setPassword(d.password); submit(d.login, d.password); }} disabled={busy}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>{d.who}</b>
                  <span className="faint ellipsis" style={{ display: 'block', fontSize: 12.5 }}>{d.meta}</span>
                </span>
                <span className="mono faint demo-cred">{d.login}<br />{d.password}</span>
              </button>
            ))}
          </div>
          <div className="row faint" style={{ fontSize: 12.5, gap: 8, alignItems: 'flex-start' }}>
            <ShieldCheck size={16} style={{ flex: 'none', marginTop: 1 }} />
            <span>Пароли хранятся только в виде bcrypt-хэша, сессия — в защищённой cookie. Каждый видит только свои данные.</span>
          </div>
          <div className="concept-note" style={{ display: 'flex', gap: 8 }}>
            <Lock size={14} style={{ flex: 'none', marginTop: 2 }} />
            <span><b>Концепт для конкурса</b> «Цифровой деканат будущего». Не официальный сервис вуза, все люди и данные вымышлены.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
