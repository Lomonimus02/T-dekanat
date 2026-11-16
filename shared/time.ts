// Общие правила времени: пары, недели, чётность. Используются и сервером, и интерфейсом.
export const SLOTS: Record<number, [string, string]> = {
  1: ['09:00', '10:30'],
  2: ['10:45', '12:15'],
  3: ['12:45', '14:15'],
  4: ['14:30', '16:00'],
  5: ['16:15', '17:45'],
  6: ['18:00', '19:30'],
};

export const SEMESTER = {
  title: 'Осенний семестр 2026/27',
  start: '2026-08-31', // понедельник первой учебной недели
  end: '2026-12-26',
  sessionStart: '2027-01-11',
  sessionEnd: '2027-01-30',
};

export const WEEKDAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const WEEKDAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function pad(n: number) { return String(n).padStart(2, '0'); }

/** YYYY-MM-DD в местном часовом поясе */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86_400_000);
}
/** 1 = понедельник … 7 = воскресенье */
export function isoWeekday(s: string): number {
  const w = parseYmd(s).getDay();
  return w === 0 ? 7 : w;
}
export function mondayOf(s: string): string {
  return addDays(s, 1 - isoWeekday(s));
}
export function studyWeek(s: string): number {
  return Math.floor(diffDays(SEMESTER.start, mondayOf(s)) / 7) + 1;
}
export function parityOf(s: string): 'odd' | 'even' {
  return studyWeek(s) % 2 === 1 ? 'odd' : 'even';
}
export function humanDate(s: string, withWeekday = false): string {
  const d = parseYmd(s);
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  return withWeekday ? `${WEEKDAYS[isoWeekday(s)].toLowerCase()}, ${base}` : base;
}
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export function relDays(n: number): string {
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === 2) return 'послезавтра';
  if (n === -1) return 'вчера';
  if (n < 0) return `${-n} ${plural(-n, 'день', 'дня', 'дней')} назад`;
  return `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
}
