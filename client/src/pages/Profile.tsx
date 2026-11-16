import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, Eye, EyeOff, KeyRound, LogOut, Monitor, Phone, Smartphone, X } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar, ErrorBox, PageSkeleton, useToast } from '../components/ui';
import { ago } from '../lib/format';
import { useTitle } from '../lib/hooks';

function device(ua: string | null) {
  if (!ua) return { name: 'Неизвестное устройство', mobile: false };
  const mobile = /Mobile|Android|iPhone/i.test(ua);
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'ОС';
  const br = /YaBrowser/i.test(ua) ? 'Яндекс Браузер' : /Edg\//i.test(ua) ? 'Edge' : /Firefox/i.test(ua) ? 'Firefox' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Браузер';
  return { name: `${br} · ${os}`, mobile };
}

export function ProfilePage() {
  useTitle('Профиль');
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const p = useQuery<any>({ queryKey: ['profile'], queryFn: () => api('/me/profile') });
  const s = useQuery<any[]>({ queryKey: ['sessions'], queryFn: () => api('/me/sessions') });
  const [allSess, setAllSess] = useState(false);
  const [reveal, setReveal] = useState(false);
  if (p.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (p.error) return <div className="page"><ErrorBox error={p.error} retry={p.refetch} /></div>;
  const d = p.data;

  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); qc.clear(); nav('/login', { replace: true }); };
  const revoke = async (id: number) => {
    try { await api(`/me/sessions/${id}`, { method: 'DELETE' }); toast('Сеанс завершён'); s.refetch(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="page">
      <div className="page-head"><h1 className="h1">Профиль</h1></div>
      <div className="profile">
        <div className="stack" style={{ alignContent: 'start' }}>
          <div className="id-card id-compact" style={{ ['--h' as any]: d.avatarHue }}>
            <Avatar first={d.firstName} last={d.lastName} hue={d.avatarHue} size={56} />
            <div style={{ minWidth: 0 }}>
              <div className="id-name">{d.lastName} {d.firstName} {d.middleName}</div>
              <div className="id-sub">{d.group} · {d.course} курс · {d.studyForm}, {d.funding.toLowerCase()}</div>
              <div className="id-sub faint">{d.programCode} {d.program}</div>
            </div>
          </div>

          <div className="panel acc-group">
            <details className="acc">
              <summary><b>Учебные данные</b><ChevronDown size={18} className="acc-chev" /></summary>
              <dl className="kv acc-body">
                <dt>Факультет</dt><dd>{d.faculty}</dd>
                <dt>Направление</dt><dd>{d.programCode} {d.program}</dd>
                <dt>Профиль</dt><dd>{d.profile}</dd>
                <dt>Годы обучения</dt><dd>{d.enrolledYear}–{d.enrolledYear + 4}</dd>
                <dt>Куратор</dt><dd>{d.curator}</dd>
                <dt>Стипендия</dt><dd>{d.stipend ?? 'не назначена'}</dd>
              </dl>
            </details>
            <details className="acc">
              <summary><b>Личные данные</b><span className="faint">скрыты</span><ChevronDown size={18} className="acc-chev" /></summary>
              <div className="acc-body">
                <dl className="kv">
                  <dt>Зачётная книжка</dt><dd className="mono">{reveal ? d.recordBook : d.recordBook?.replace(/\d(?=\d{2})/g, '•')}</dd>
                  <dt>Почта</dt><dd className="ellipsis">{reveal ? d.email : d.email?.replace(/^(.).+(@.+)$/, '$1•••$2')}</dd>
                  <dt>Телефон</dt><dd className="mono">{reveal ? d.phone : d.phone?.replace(/\d(?=(?:\D*\d){2})/g, '•')}</dd>
                </dl>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setReveal(!reveal)} aria-pressed={reveal}>{reveal ? <EyeOff size={16} /> : <Eye size={16} />}{reveal ? 'Скрыть' : 'Показать'}</button>
                <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>Хранятся зашифрованными (AES-256-GCM).</p>
              </div>
            </details>
            <details className="acc">
              <summary><b>Контакты деканата</b><span className="faint">каб. {d.deanOffice.room}</span><ChevronDown size={18} className="acc-chev" /></summary>
              <div className="acc-body stack" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 10 }}><Building2 size={17} className="faint" /><span>{d.faculty}, кабинет {d.deanOffice.room}</span></div>
                <div className="row" style={{ gap: 10 }}><KeyRound size={17} className="faint" /><span>{d.deanOffice.hours}</span></div>
                <div className="row" style={{ gap: 10 }}><Phone size={17} className="faint" /><span className="mono">{d.deanOffice.phone}</span></div>
                <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => nav('/requests/new/question')}>Задать вопрос онлайн</button>
              </div>
            </details>
            <details className="acc">
              <summary><b>Активные сеансы</b><span className="faint">{s.data?.length ?? ''}</span><ChevronDown size={18} className="acc-chev" /></summary>
              <div className="acc-body">
                {s.isLoading ? <p className="faint">Загрузка…</p> : s.error ? <ErrorBox error={s.error} /> : (
                  <ul className="sessions">
                    {(allSess ? s.data! : s.data!.slice(0, 4)).map((x) => {
                      const dv = device(x.user_agent);
                      return (
                        <li key={x.id}>
                          {dv.mobile ? <Smartphone size={18} className="faint" /> : <Monitor size={18} className="faint" />}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="ellipsis" style={{ fontWeight: 600 }}>{dv.name}</div>
                            <div className="faint" style={{ fontSize: 12.5 }}>{x.current ? 'этот сеанс' : `активность ${ago(x.last_seen)}`}{x.ip ? ` · ${x.ip}` : ''}</div>
                          </div>
                          {x.current ? <span className="chip chip-xs tone-top">сейчас</span> : <button className="icon-btn" onClick={() => revoke(x.id)} aria-label="Завершить сеанс" title="Завершить сеанс"><X size={17} /></button>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(s.data?.length ?? 0) > 4 && <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setAllSess(!allSess)} aria-expanded={allSess}>{allSess ? 'Свернуть' : `Все сеансы (${s.data!.length})`}</button>}
              </div>
            </details>
          </div>
          <button className="btn btn-danger btn-block" onClick={logout}><LogOut size={16} /> Выйти из кабинета</button>
        </div>
      </div>
    </div>
  );
}
