import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, FileText, GraduationCap, Home, Inbox, LogOut, Megaphone, Menu, Search, User } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar, Brand, Dialog, LogoMark } from './ui';
import { Navigator } from './Navigator';
import { useMe } from '../lib/auth';

type Item = { to: string; label: string; short?: string; icon: ReactNode; end?: boolean; badge?: number };

const CONCEPT = (
  <div className="concept-note">
    <b>Концепт для конкурса</b> «Цифровой деканат будущего». Не официальный сервис вуза. Все данные вымышлены.
  </div>
);

export function SiteFoot() {
  return <footer className="site-foot"><span className="hide-m">Stellar · Деканат — концепт для конкурса «Цифровой деканат будущего». Не является официальным сервисом какого-либо вуза; люди, оценки и документы вымышлены.</span><span className="show-m">Концепт для конкурса · данные вымышлены</span></footer>;
}

/** Куда ведёт «назад» на вложенных страницах (на телефоне — кнопка в шапке). */
function backTarget(path: string): { to: string; label: string } | null {
  if (/^\/grades\/[^/]+/.test(path)) return { to: '/grades', label: 'Успеваемость' };
  if (/^\/requests\/new\/[^/]+/.test(path)) return { to: '/requests/new', label: 'Новая заявка' };
  if (path === '/requests/new') return { to: '/requests', label: 'Заявки и справки' };
  if (/^\/requests\/[^/]+/.test(path)) return { to: '/requests', label: 'Заявки и справки' };
  if (/^\/staff\/requests\/[^/]+/.test(path)) return { to: '/staff', label: 'Заявки студентов' };
  return null;
}

export function Shell() {
  const me = useMe();
  const staff = me.data?.role === 'staff';
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [navOpen, setNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const home = useQuery({ queryKey: ['home'], queryFn: () => api('/home'), enabled: me.data?.role === 'student' });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/me/profile'), enabled: me.data?.role === 'student' });
  const unread = (home.data as any)?.unread ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!staff && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setNavOpen(true); }
    };
    const onOpen = () => setNavOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-navigator', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('open-navigator', onOpen); };
  }, [staff]);
  useEffect(() => { window.scrollTo(0, 0); setMoreOpen(false); }, [loc.pathname]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    qc.clear();
    nav('/login', { replace: true });
  };

  const items: Item[] = staff
    ? [
        { to: '/staff', label: 'Заявки студентов', short: 'Заявки', icon: <Inbox size={20} />, end: false },
        { to: '/staff/announcements', label: 'Объявления', icon: <Megaphone size={20} /> },
      ]
    : [
        { to: '/', label: 'Главная', icon: <Home size={20} />, end: true },
        { to: '/schedule', label: 'Расписание', icon: <CalendarDays size={20} /> },
        { to: '/grades', label: 'Успеваемость', short: 'Оценки', icon: <GraduationCap size={20} /> },
        { to: '/requests', label: 'Заявки и справки', short: 'Заявки', icon: <FileText size={20} /> },
        { to: '/notifications', label: 'Уведомления', icon: <Bell size={20} />, badge: unread },
        { to: '/profile', label: 'Профиль', icon: <User size={20} /> },
      ];
  const isActive = (i: Item) => (i.end ? loc.pathname === i.to : i.to === '/staff' ? loc.pathname === '/staff' || loc.pathname.startsWith('/staff/requests') : loc.pathname.startsWith(i.to));
  const tabs = staff ? items : items.slice(0, 4);
  const moreItems = staff ? [] : items.slice(4);
  const moreActive = moreItems.some(isActive);
  const back = backTarget(loc.pathname);
  const name = me.data?.name ?? '';

  return (
    <div className="app">
      <a href="#main" className="sr-only">К содержимому</a>
      <aside className="rail" aria-label="Навигация">
        <NavLink to={staff ? '/staff' : '/'} className="brand-link" aria-label="На главную"><Brand /></NavLink>
        {!staff && (
          <button className="nav-search" onClick={() => setNavOpen(true)}>
            <Search size={18} /> <span>Поиск</span> <kbd className="mono">Ctrl K</kbd>
          </button>
        )}
        <nav className="stack" style={{ gap: 4 }}>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={() => `nav-item ${isActive(i) ? 'active' : ''}`}>
              {i.icon}<span>{i.label}</span>{!!i.badge && <span className="count" aria-label={`${i.badge} непрочитанных`}>{i.badge > 99 ? '99+' : i.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          {CONCEPT}
          <div className="row">
            <NavLink to={staff ? '/staff' : '/profile'} className="rail-user row" style={{ flex: 1, minWidth: 0 }}>
              <Avatar first={profile.data?.firstName ?? name.split(' ')[1]} last={profile.data?.lastName ?? name.split(' ')[0]} size={36} />
              <span style={{ minWidth: 0 }}>
                <span className="ellipsis" style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{name}</span>
                <span className="faint ellipsis" style={{ display: 'block', fontSize: 12.5 }}>{staff ? 'Учебный офис' : profile.data?.group ?? 'Студент'}</span>
              </span>
            </NavLink>
            <button className="icon-btn" onClick={logout} aria-label="Выйти" title="Выйти"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <header className={`topbar ${back ? 'has-back' : ''}`}>
        {back ? (
          <NavLink to={back.to} className="topbar-back" aria-label={`Назад: ${back.label}`}><ChevronLeft size={24} /><span className="ellipsis">{back.label}</span></NavLink>
        ) : (
          <NavLink to={staff ? '/staff' : '/'} className="topbar-brand" aria-label="На главную"><LogoMark size={32} /><span className="brand-word">Stellar<small>Деканат</small></span></NavLink>
        )}
        <span className="grow" />
        {!staff && <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label="Поиск"><Search size={21} /></button>}
        {!staff && (
          <NavLink to="/notifications" className="icon-btn" aria-label={`Уведомления${unread ? `, ${unread} новых` : ''}`}>
            <Bell size={21} />{unread > 0 && <span className="badge" />}
          </NavLink>
        )}
      </header>

      <main className="main" id="main">
        <Outlet />
        <SiteFoot />
      </main>

      <nav className="tabbar" aria-label="Разделы" style={staff ? { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } : undefined}>
        {tabs.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={() => `tab ${isActive(i) && !moreOpen ? 'active' : ''}`}>
            {i.icon}<span>{i.short ?? i.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`tab ${moreActive || moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <Menu size={20} /><span>Ещё</span>{unread > 0 && !staff && <i className="tab-dot" aria-label="Есть непрочитанные" />}
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} label="Ещё">
        <div className="more">
          <div className="more-user">
            <Avatar first={profile.data?.firstName ?? name.split(' ')[1]} last={profile.data?.lastName ?? name.split(' ')[0]} size={44} />
            <span style={{ minWidth: 0 }}>
              <b className="ellipsis" style={{ display: 'block' }}>{name}</b>
              <span className="faint ellipsis" style={{ display: 'block', fontSize: 13 }}>{staff ? 'Учебный офис' : `${profile.data?.group ?? 'Студент'} · ${profile.data?.course ?? ''} курс`}</span>
            </span>
          </div>
          <nav className="more-list">
            {moreItems.map((i) => (
              <NavLink key={i.to} to={i.to} className="more-item">
                <span className="more-ico">{i.icon}</span><span>{i.label}</span>
                {!!i.badge && <span className="count">{i.badge > 99 ? '99+' : i.badge}</span>}
                <ChevronRight size={18} className="faint" />
              </NavLink>
            ))}
            {!staff && (
              <button className="more-item" onClick={() => { setMoreOpen(false); setNavOpen(true); }}>
                <span className="more-ico"><Search size={20} /></span><span>Поиск по кабинету</span><ChevronRight size={18} className="faint" />
              </button>
            )}
            <button className="more-item is-danger" onClick={logout}>
              <span className="more-ico"><LogOut size={20} /></span><span>Выйти</span>
            </button>
          </nav>
          {CONCEPT}
        </div>
      </Dialog>

      {!staff && <Navigator open={navOpen} onClose={() => setNavOpen(false)} />}
    </div>
  );
}
