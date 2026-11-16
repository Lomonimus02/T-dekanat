import type React from "react";
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, ChevronRight, CalendarClock, CalendarDays, FileCheck2, FileText, TrendingUp, BellRing, GraduationCap } from 'lucide-react';
import { Stories } from '../components/Stories';
import { api } from '../lib/api';
import { ErrorBox, PageSkeleton, TONE_COLOR } from '../components/ui';
import { type Occ } from '../components/Lesson';
import { countdown, dayShort, greeting, humanDate, plural } from '../lib/format';
import { useNow, useTitle } from '../lib/hooks';
import { STATUS_LABEL, type Status } from '../../../shared/requests';

const ICON: Record<string, React.ReactElement> = {
  deadline: <CalendarClock size={18} />, change: <CalendarDays size={18} />, request: <FileCheck2 size={18} />, risk: <TrendingUp size={18} />, debt: <AlertOctagon size={18} />, news: <BellRing size={18} />,
};

/** Главная: истории деканата, короткий список «Требует внимания» и плитки-сводки, каждая ведёт в свой раздел. */
export function HomePage() {
  useTitle('Главная');
  const { data, isLoading, error, refetch } = useQuery<any>({ queryKey: ['home'], queryFn: () => api('/home') });
  const now = useNow();
  if (isLoading) return <div className="page"><PageSkeleton /></div>;
  if (error || !data) return <div className="page"><ErrorBox error={error} retry={refetch} /></div>;

  const hm = new Date(now).toTimeString().slice(0, 5);
  const todayLeft = (data.todayLessons as Occ[]).filter((o) => o.end > hm && o.status !== 'cancelled' && o.status !== 'moved_out');
  const next: Occ | null = todayLeft[0] ?? data.nextLesson;
  const nextAt = next ? new Date(`${next.date}T${next.start}:00`).getTime() : 0;
  const digest: any[] = data.digest;
  const attention = digest.filter((d) => ['request', 'debt', 'risk', 'news'].includes(d.kind));
  const deadlines = digest.filter((d) => d.kind === 'deadline');
  const changes = digest.filter((d) => d.kind === 'change');
  const ov = data.overview;
  const reqs: any[] = data.requests;
  const ready = reqs.filter((r) => r.status === 'ready').length;
  const waiting = reqs.filter((r) => r.status === 'needs_info').length;

  return (
    <div className="page home">
      <div className="home-head">
        <h1 className="h1">{greeting()}, {data.profile.firstName}</h1>
        <p className="page-sub">{data.profile.group} · {data.week}-я неделя, {data.parity === 'odd' ? 'нечётная' : 'чётная'}</p>
      </div>

      <Stories items={data.stories ?? []} />

      {attention.length > 0 && (
        <section className="panel attention" aria-labelledby="att-t">
          <h2 className="h2 att-title" id="att-t">Требует внимания <span className="count">{attention.length}</span></h2>
          <ul className="att-list">
            {attention.slice(0, 3).map((d) => (
              <li key={d.id}>
                <Link to={d.action?.to ?? '/'} className={`att dg-${d.tone}`}>
                  <span className="att-ico">{ICON[d.kind]}</span>
                  <span className="att-t">{d.title}</span>
                  <ChevronRight size={18} className="faint" />
                </Link>
              </li>
            ))}
          </ul>
          {attention.length > 3 && <Link to="/notifications" className="link att-more">Ещё {attention.length - 3} в уведомлениях</Link>}
        </section>
      )}

      <div className="tiles">
        <Link to={next ? `/schedule?date=${next.date}` : '/schedule'} className="tile tile-wide">
          <span className="tile-k"><CalendarDays size={16} />{todayLeft.length ? 'Сегодня' : 'Ближайшее занятие'}</span>
          {next ? (
            <>
              <b className="tile-v clamp2">{next.discipline.name}</b>
              <span className="tile-s">{next.date === data.today ? '' : `${dayShort(next.date)}, ${humanDate(next.date)} · `}{next.start} · ауд. {next.room} · <b>{countdown(nextAt)}</b></span>
            </>
          ) : <b className="tile-v">Занятий нет</b>}
        </Link>
        <Link to="/grades" className="tile tile-brand">
          <span className="tile-k"><GraduationCap size={16} />Рейтинг</span>
          <b className="tile-v num">{ov.rating}<small> / 100</small></b>
          <span className="tile-s">{ov.stipend.title}</span>
        </Link>
        <Link to="/notifications?f=deadline" className="tile">
          <span className="tile-k"><CalendarClock size={16} />Дедлайны</span>
          <b className="tile-v num">{deadlines.length}<small> за 7 дней</small></b>
          <span className="tile-s ellipsis">{deadlines[0] ? deadlines[0].title : 'Сдавать ничего не нужно'}</span>
        </Link>
        <Link to={changes[0]?.action?.to ?? '/schedule'} className="tile">
          <span className="tile-k"><CalendarDays size={16} />Изменения</span>
          <b className="tile-v num">{changes.length}<small> в расписании</small></b>
          <span className="tile-s ellipsis">{changes[0] ? changes[0].title : 'Всё по плану'}</span>
        </Link>
        <Link to="/requests" className="tile">
          <span className="tile-k"><FileText size={16} />Заявки</span>
          <b className="tile-v num">{reqs.length}<small> в работе</small></b>
          <span className="tile-s ellipsis">{ready ? `${ready} ${plural(ready, 'готова', 'готовы', 'готово')}` : waiting ? 'Нужен ваш ответ' : reqs[0] ? STATUS_LABEL[reqs[0].status as Status] : 'Новая заявка →'}</span>
        </Link>
      </div>
    </div>
  );
}

export { TONE_COLOR };
