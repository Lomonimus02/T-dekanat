import { WEEKDAYS, WEEKDAYS_SHORT, humanDate, isoWeekday, plural } from '../../../shared/time';
export * from '../../../shared/time';

export function dateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'только что';
  if (s < 3600) { const m = Math.floor(s / 60); return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`; }
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`; }
  const d = Math.floor(s / 86400);
  if (d < 7) return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
export function dayTitle(s: string) { return `${WEEKDAYS[isoWeekday(s)]}, ${humanDate(s)}`; }
export function dayShort(s: string) { return WEEKDAYS_SHORT[isoWeekday(s)]; }
export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
export function initials(a?: string, b?: string) { return `${(a ?? '')[0] ?? ''}${(b ?? '')[0] ?? ''}`.toUpperCase(); }
/** Сколько осталось до момента в человеческом виде */
export function countdown(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return 'идёт сейчас';
  const m = Math.round(diff / 60000);
  if (m < 60) return `через ${m} ${plural(m, 'минуту', 'минуты', 'минут')}`;
  const h = Math.floor(m / 60);
  if (h < 24) { const mm = m % 60; return `через ${h} ч${mm ? ` ${mm} мин` : ''}`; }
  const d = Math.round(h / 24);
  return `через ${d} ${plural(d, 'день', 'дня', 'дней')}`;
}
