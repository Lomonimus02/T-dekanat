// Балльно-рейтинговая система (вымышленный регламент университета «Стеллар»):
// семестр даёт до 60 баллов, экзамен или зачётное испытание — до 40. Допуск — от 30 баллов семестра.
export const ADMISSION_MIN = 30;
export const THRESHOLDS = { excellent: 85, good: 70, pass: 55 };

export type Control = 'exam' | 'zachet' | 'diff';
export const CONTROL_LABEL: Record<Control, string> = { exam: 'Экзамен', zachet: 'Зачёт', diff: 'Дифф. зачёт' };

export function gradeFor(total: number, control: Control): { label: string; tone: 'top' | 'good' | 'ok' | 'bad' } {
  if (control === 'zachet') return total >= THRESHOLDS.pass ? { label: 'зачтено', tone: 'top' } : { label: 'не зачтено', tone: 'bad' };
  if (total >= THRESHOLDS.excellent) return { label: 'отлично', tone: 'top' };
  if (total >= THRESHOLDS.good) return { label: 'хорошо', tone: 'good' };
  if (total >= THRESHOLDS.pass) return { label: 'удовлетворительно', tone: 'ok' };
  return { label: 'неудовлетворительно', tone: 'bad' };
}
