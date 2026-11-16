import { ArrowRightLeft, SquareX, DoorOpen, MapPin, User, UserCog } from 'lucide-react';
import { SLOTS, WEEKDAYS_SHORT, humanDate, isoWeekday } from '../lib/format';

export type Occ = {
  key: string; date: string; slot: number; start: string; end: string;
  discipline: { id: number; code: string; name: string; short: string; hue: number };
  kind: string; room: string; teacher: string;
  status: 'normal' | 'moved_out' | 'moved_in' | 'cancelled' | 'room' | 'teacher';
  change?: { reason: string | null; fromDate?: string; fromSlot?: number; toDate?: string; toSlot?: number; oldRoom?: string; oldTeacher?: string };
};

const when = (d?: string, slot?: number) => (d ? `${WEEKDAYS_SHORT[isoWeekday(d)]}, ${humanDate(d)}${slot ? `, ${SLOTS[slot][0]}` : ''}` : '');

export function changeText(o: Occ) {
  switch (o.status) {
    case 'moved_out': return { icon: <ArrowRightLeft size={14} />, title: `Перенесена на ${when(o.change?.toDate, o.change?.toSlot)}`, tone: 'info' };
    case 'moved_in': return { icon: <ArrowRightLeft size={14} />, title: `Перенесена сюда с ${when(o.change?.fromDate, o.change?.fromSlot)}`, tone: 'info' };
    case 'cancelled': return { icon: <SquareX size={14} />, title: 'Занятие отменено', tone: 'bad' };
    case 'room': return { icon: <DoorOpen size={14} />, title: `Новая аудитория: ${o.room}`, tone: 'warn' };
    case 'teacher': return { icon: <UserCog size={14} />, title: `Замена: ведёт ${o.teacher}`, tone: 'warn' };
    default: return null;
  }
}

const BADGE: Record<string, { label: string; tone: string } | undefined> = {
  moved_out: { label: 'Перенос', tone: 'info' }, moved_in: { label: 'Перенос', tone: 'info' },
  cancelled: { label: 'Отменено', tone: 'bad' }, room: { label: 'Изменено', tone: 'warn' }, teacher: { label: 'Изменено', tone: 'warn' },
};

export function LessonCard({ o, now, compact = false }: { o: Occ; now?: string; compact?: boolean }) {
  const off = o.status === 'cancelled' || o.status === 'moved_out';
  const live = now && !off && now >= o.start && now < o.end;
  const badge = BADGE[o.status];
  const fromTime = o.status === 'moved_in' && o.change?.fromSlot && SLOTS[o.change.fromSlot][0] !== o.start ? SLOTS[o.change.fromSlot][0] : null;
  const note = o.status === 'moved_out' ? `Перенесено на ${when(o.change?.toDate, o.change?.toSlot)}`
    : o.status === 'moved_in' ? `Перенесено с ${when(o.change?.fromDate, o.change?.fromSlot)}`
    : null;
  return (
    <article className={`lesson ${off ? 'is-off' : ''} ${live ? 'is-live' : ''} ${badge ? `is-changed ch-${badge.tone}` : ''} ${compact ? 'is-compact' : ''}`} style={{ ['--h' as any]: o.discipline.hue }}>
      <div className="lesson-time mono">
        {fromTime && <s className="old">{fromTime}</s>}
        <span className={fromTime ? 'new' : ''}>{o.start}</span>
        <span className="faint">{o.end}</span>
      </div>
      <div className="lesson-body">
        <div className="lesson-top">
          <span className="lesson-kind">{o.kind}</span>
          {badge && <span className={`chip chip-xs tone-${badge.tone}`}>{badge.label}</span>}
          {live && <span className="chip chip-xs tone-top"><span className="pip" />идёт</span>}
        </div>
        <h3 className="lesson-title">{o.discipline.name}</h3>
        <div className="lesson-meta">
          <span>
            <MapPin size={14} />
            {o.status === 'room' && o.change?.oldRoom && <s className="old">{o.change.oldRoom}</s>}
            <span className={o.status === 'room' ? 'new' : ''}>{o.room}</span>
          </span>
          <span className="ellipsis">
            <User size={14} />
            {o.status === 'teacher' && o.change?.oldTeacher && <s className="old">{o.change.oldTeacher}</s>}
            <span className={o.status === 'teacher' ? 'new' : ''}>{o.teacher}</span>
          </span>
        </div>
        {(note || (o.change?.reason && badge && !compact)) && (
          <p className="lesson-note">{note && <b>{note}. </b>}{!compact && o.change?.reason}</p>
        )}
      </div>
    </article>
  );
}
