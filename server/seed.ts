// Демо-данные. ВСЕ люди, оценки, номера зачёток и телефоны вымышлены.
// Даты считаются от дня запуска, чтобы кабинет всегда выглядел «живым».
import bcrypt from 'bcryptjs';
import { pool, tx } from './db.js';
import { migrate } from './migrate.js';
import { encrypt, randomToken } from './lib/crypto.js';
import { addDays, isoWeekday, parityOf, ymd } from '../shared/time.js';

const T = ymd(new Date());
const D = (n: number) => addDays(T, n);

type Cp = [title: string, kind: string, dayOffset: number, max: number, share?: number];
type Disc = {
  code: string; name: string; short: string; teacher: string; credits: number; control: 'exam' | 'zachet' | 'diff'; hue: number;
  cps: Cp[]; perf: number; attendance: [number, number];
  lessons: [weekday: number, slot: number, kind: string, room: string, parity?: 'all' | 'odd' | 'even'][];
  exam?: [date: string, time: string, room: string];
};

const finalCp = (control: Disc['control']): Cp =>
  control === 'exam' ? ['Экзамен', 'экзамен', 999, 40] : control === 'diff' ? ['Дифф. зачёт', 'зачёт', 998, 40] : ['Зачётное испытание', 'зачёт', 997, 40];

const A_DISC: Disc[] = [
  { code: 'АСД', name: 'Алгоритмы и структуры данных', short: 'АСД', teacher: 'Соколов Д. А.', credits: 5, control: 'exam', hue: 162, perf: 0.93, attendance: [27, 28],
    cps: [['ДЗ 1. Сортировки', 'дз', -48, 10], ['Контрольная 1', 'кр', -27, 15], ['ДЗ 2. Графы', 'дз', -6, 10], ['Курсовой проект: этап 1', 'проект', 9, 10], ['Контрольная 2', 'кр', 23, 15]],
    lessons: [[1, 1, 'Лекция', 'К1-305'], [3, 3, 'Семинар', 'К2-214'], [5, 3, 'Лабораторная', 'К3-110']], exam: ['2027-01-13', '10:00', 'К1-305'] },
  { code: 'БД', name: 'Базы данных', short: 'БД', teacher: 'Кравец Н. И.', credits: 4, control: 'exam', hue: 205, perf: 0.9, attendance: [22, 24],
    cps: [['Лабораторная 1–2', 'лаб', -41, 12], ['Лабораторная 3. Нормализация', 'лаб', -13, 12], ['Лабораторная 4. Индексы', 'лаб', 3, 12], ['Тест по SQL', 'тест', 16, 12], ['Мини-проект', 'проект', 30, 12]],
    lessons: [[1, 2, 'Лабораторная', 'К3-112'], [4, 1, 'Лекция', 'К1-201']], exam: ['2027-01-18', '09:00', 'К1-201'] },
  { code: 'МА', name: 'Математический анализ', short: 'МА', teacher: 'Белозёрова Т. М.', credits: 5, control: 'exam', hue: 265, perf: 0.86, attendance: [30, 32],
    cps: [['Коллоквиум 1', 'кр', -35, 15], ['Типовой расчёт 1', 'дз', -20, 10], ['Типовой расчёт 2', 'дз', 12, 10], ['Коллоквиум 2', 'кр', 26, 25]],
    lessons: [[2, 1, 'Лекция', 'К1-101'], [2, 2, 'Практика', 'К2-305'], [5, 2, 'Практика', 'К2-305']], exam: ['2027-01-22', '10:00', 'К1-101'] },
  { code: 'ДМ', name: 'Дискретная математика', short: 'ДМ', teacher: 'Ушаков П. Л.', credits: 3, control: 'diff', hue: 32, perf: 0.6, attendance: [17, 22],
    cps: [['Контрольная 1', 'кр', -30, 20], ['ДЗ. Комбинаторика', 'дз', -9, 10], ['Контрольная 2', 'кр', 5, 20], ['ДЗ. Графы', 'дз', 19, 10]],
    lessons: [[3, 2, 'Лекция', 'К1-210'], [4, 3, 'Практика', 'К2-118']] },
  { code: 'ВЕБ', name: 'Веб-разработка', short: 'ВЕБ', teacher: 'Ларин Е. С.', credits: 3, control: 'zachet', hue: 330, perf: 0.97, attendance: [15, 16],
    cps: [['Вёрстка макета', 'лаб', -38, 15], ['SPA на React', 'лаб', -16, 15], ['Проект: личный кабинет', 'проект', 8, 15], ['Защита проекта', 'проект', 34, 15]],
    lessons: [[3, 4, 'Лабораторная', 'К3-204', 'odd'], [4, 2, 'Лекция', 'К1-210']] },
  { code: 'ENG', name: 'Английский язык', short: 'ENG', teacher: 'Миронова А. В.', credits: 2, control: 'zachet', hue: 95, perf: 0.88, attendance: [14, 16],
    cps: [['Тест Unit 1–3', 'тест', -33, 20], ['Эссе: Tech & Society', 'дз', 4, 20], ['Презентация', 'проект', 25, 20]],
    lessons: [[2, 3, 'Практика', 'К4-402'], [5, 4, 'Практика', 'К4-402', 'even']] },
];

const B_DISC: Disc[] = [
  { code: 'ЭКМ', name: 'Эконометрика', short: 'ЭКМ', teacher: 'Руденко В. П.', credits: 5, control: 'exam', hue: 12, perf: 0.42, attendance: [13, 20],
    cps: [['ДЗ 1. Парная регрессия', 'дз', -40, 10], ['Контрольная 1', 'кр', -19, 20], ['Лабораторная в Gretl', 'лаб', -4, 10], ['Контрольная 2', 'кр', 9, 20]],
    lessons: [[1, 2, 'Лекция', 'Э-401'], [3, 3, 'Практика', 'Э-215'], [5, 4, 'Лабораторная', 'Э-120']], exam: ['2027-01-14', '10:00', 'Э-401'] },
  { code: 'ФМ', name: 'Финансовый менеджмент', short: 'ФМ', teacher: 'Шестакова И. Ю.', credits: 4, control: 'exam', hue: 205, perf: 0.71, attendance: [19, 22],
    cps: [['Кейс 1. Оценка проекта', 'дз', -36, 15], ['Тест', 'тест', -12, 15], ['Кейс 2. Структура капитала', 'дз', 6, 15], ['Контрольная', 'кр', 22, 15]],
    lessons: [[1, 3, 'Семинар', 'Э-302'], [3, 2, 'Лекция', 'Э-401']], exam: ['2027-01-20', '12:00', 'Э-401'] },
  { code: 'КФ', name: 'Корпоративные финансы', short: 'КФ', teacher: 'Ахмеров Р. Ф.', credits: 3, control: 'diff', hue: 162, perf: 0.82, attendance: [18, 20],
    cps: [['Эссе', 'дз', -31, 20], ['Контрольная 1', 'кр', -10, 20], ['Групповой проект', 'проект', 13, 20]],
    lessons: [[2, 2, 'Семинар', 'Э-215'], [4, 1, 'Лекция', 'Э-301']] },
  { code: 'МАК', name: 'Макроэкономика (продвинутый курс)', short: 'МАК', teacher: 'Полякова О. Н.', credits: 4, control: 'exam', hue: 265, perf: 0.64, attendance: [20, 24],
    cps: [['Коллоквиум', 'кр', -26, 20], ['Задачи по моделям роста', 'дз', -7, 10], ['Контрольная 2', 'кр', 17, 20], ['Реферат', 'дз', 29, 10]],
    lessons: [[2, 1, 'Лекция', 'Э-401'], [4, 2, 'Семинар', 'Э-306']], exam: ['2027-01-26', '10:00', 'Э-401'] },
  { code: 'ENG', name: 'Деловой английский', short: 'ENG', teacher: 'Миронова А. В.', credits: 2, control: 'zachet', hue: 95, perf: 0.9, attendance: [15, 16],
    cps: [['Business letter', 'дз', -29, 20], ['Mid-term test', 'тест', -8, 20], ['Negotiation role-play', 'проект', 11, 20]],
    lessons: [[2, 4, 'Практика', 'К4-405'], [6, 1, 'Практика', 'К4-405', 'even']] },
  { code: 'БА', name: 'Бизнес-аналитика на Python', short: 'БА', teacher: 'Ларин Е. С.', credits: 3, control: 'zachet', hue: 330, perf: 0.95, attendance: [16, 16],
    cps: [['Pandas: очистка данных', 'лаб', -34, 15], ['Дашборд продаж', 'лаб', -14, 15], ['Итоговый проект', 'проект', 20, 30]],
    lessons: [[3, 4, 'Лабораторная', 'К3-108'], [5, 3, 'Лекция', 'К1-210', 'odd']] },
];

/** Ближайшая дата (от сегодня, вперёд на offsetWeeks) с нужным днём недели и чётностью */
function nextLessonDate(weekday: number, parity: string, minOffset: number): string {
  for (let i = minOffset; i < minOffset + 21; i++) {
    const d = D(i);
    if (isoWeekday(d) === weekday && (parity === 'all' || parityOf(d) === parity)) return d;
  }
  return D(minOffset);
}

async function main() {
  await migrate();
  await tx(async (c) => {
    await c.query(`TRUNCATE users, faculties, groups, notifications, audit_log, login_attempts RESTART IDENTITY CASCADE`);
    await c.query(`ALTER SEQUENCE request_no RESTART WITH 140`);

    const fac = async (code: string, name: string, short: string, room: string, hours: string, phone: string) =>
      (await c.query(`INSERT INTO faculties(code,name,short,dean_office_room,dean_office_hours,dean_office_phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [code, name, short, room, hours, phone])).rows[0].id as number;
    const fkn = await fac('fkn', 'Факультет компьютерных наук', 'ФКН', 'К1-214', 'Пн–Чт 10:00–17:00, Пт 10:00–15:00', '+7 (000) 100-02-14');
    const ef = await fac('ef', 'Экономический факультет', 'ЭФ', 'Э-108', 'Пн–Пт 09:30–16:30', '+7 (000) 100-01-08');

    const grp = async (name: string, f: number, code: string, prog: string, profile: string, course: number, curator: string) =>
      (await c.query(`INSERT INTO groups(name,faculty_id,program_code,program_name,profile,course,curator) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [name, f, code, prog, profile, course, curator])).rows[0].id as number;
    const gA = await grp('ПИ-25-1', fkn, '09.03.04', 'Программная инженерия', 'Разработка программных систем', 2, 'Ларин Евгений Сергеевич');
    const gB = await grp('ЭК-24-2', ef, '38.03.01', 'Экономика', 'Финансы и кредит', 3, 'Ахмеров Ринат Фаридович');

    const user = async (login: string, pass: string, role: string, ln: string, fn: string, mn: string) =>
      (await c.query(`INSERT INTO users(login,password_hash,role,last_name,first_name,middle_name) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [login, await bcrypt.hash(pass, 11), role, ln, fn, mn])).rows[0].id as string;

    const uA = await user('vetrova', 'Orbita-2026', 'student', 'Ветрова', 'Мирослава', 'Андреевна');
    const uB = await user('galeev', 'Kometa-2026', 'student', 'Галеев', 'Тимур', 'Ринатович');
    const uS = await user('dekanat', 'Zvezda-2026', 'staff', 'Лаврова', 'Ольга', 'Сергеевна');

    await c.query(`INSERT INTO students VALUES ($1,$2,'Очная','Бюджет',2025,$3,$4,$5,$6,'Академическая повышенная',168)`,
      [uA, gA, encrypt('25-0417'), encrypt('m.vetrova@student.stellar.example'), encrypt('+7 (900) 000-41-17'), encrypt('2007-03-12')]);
    await c.query(`INSERT INTO students VALUES ($1,$2,'Очная','Бюджет',2024,$3,$4,$5,$6,NULL,24)`,
      [uB, gB, encrypt('24-1093'), encrypt('t.galeev@student.stellar.example'), encrypt('+7 (900) 000-10-93'), encrypt('2005-09-30')]);
    await c.query(`INSERT INTO staff VALUES ($1,'Специалист по учебной работе',NULL)`, [uS]);

    // Дисциплины, контрольные точки, баллы, расписание
    const changes: { gid: number; lesson: number; weekday: number; slot: number; parity: string; room: string; teacher: string; code: string; name: string }[] = [];
    for (const [uid, gid, discs] of [[uA, gA, A_DISC], [uB, gB, B_DISC]] as const) {
      for (const d of discs) {
        const did = (await c.query(`INSERT INTO disciplines(group_id,code,name,short,teacher,credits,control,hue) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [gid, d.code, d.name, d.short, d.teacher, d.credits, d.control, d.hue])).rows[0].id;
        const cps = [...d.cps, finalCp(d.control)];
        let i = 0;
        for (const [title, kind, off, max] of cps) {
          const due = off >= 997 ? (d.exam ? d.exam[0] : '2026-12-' + (21 + (i % 5))) : D(off);
          const cp = (await c.query(`INSERT INTO control_points(discipline_id,title,kind,due_date,max_score) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [did, title, kind, due, max])).rows[0].id;
          if (off < 0) {
            const jitter = ((i * 37 + d.code.length * 11) % 13) / 100 - 0.06;
            const s = Math.max(0, Math.min(max, Math.round(max * Math.min(1, d.perf + jitter) * 2) / 2));
            await c.query(`INSERT INTO scores VALUES ($1,$2,$3,$4)`, [uid, cp, s, D(off + 3)]);
          }
          i++;
        }
        await c.query(`INSERT INTO attendance VALUES ($1,$2,$3,$4)`, [uid, did, d.attendance[0], d.attendance[1]]);
        for (const [wd, slot, kind, room, parity = 'all'] of d.lessons) {
          const lid = (await c.query(`INSERT INTO lessons(discipline_id,weekday,slot,kind,room,teacher,parity) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [did, wd, slot, kind, room, d.teacher, parity])).rows[0].id;
          changes.push({ gid, lesson: lid, weekday: wd, slot, parity, room, teacher: d.teacher, code: d.code, name: d.name });
        }
        if (d.exam) {
          const [date, time, room] = d.exam;
          await c.query(`INSERT INTO exams(discipline_id,kind,starts_at,room,consultation_at,consultation_room) VALUES ($1,'Экзамен',$2,$3,$4,$5)`,
            [did, `${date}T${time}:00+03:00`, room, `${addDays(date, -1)}T15:00:00+03:00`, room]);
        }
      }
    }

    // Изменения в расписании на ближайшие три недели — для каждой группы своё
    const find = (gid: number, code: string, wd: number) => changes.find((x) => x.gid === gid && x.code === code && x.weekday === wd)!;
    const addChange = async (gid: number, code: string, wd: number, weekOffset: number, kind: string, extra: { new_date?: string; new_slot?: number; new_room?: string; new_teacher?: string; reason: string }) => {
      const l = find(gid, code, wd);
      const on = nextLessonDate(wd, l.parity, 1 + weekOffset * 7);
      const newDate = extra.new_date ? nextLessonDate(Number(extra.new_date), 'all', diffFromT(on)) : null;
      await c.query(`INSERT INTO lesson_changes(lesson_id,on_date,kind,new_date,new_slot,new_room,new_teacher,reason,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() - interval '5 hours')`,
        [l.lesson, on, kind, newDate, extra.new_slot ?? null, extra.new_room ?? null, extra.new_teacher ?? null, extra.reason]);
      const what = kind === 'moved' ? 'перенос' : kind === 'cancelled' ? 'отмена' : kind === 'room' ? 'новая аудитория' : 'замена преподавателя';
      await c.query(`INSERT INTO notifications(kind,title,body,link,group_id,author,created_at) VALUES ('change',$1,$2,'/schedule?date=' || $3,$4,'Учебный офис', now() - interval '5 hours')`,
        [`${l.name}: ${what}`, extra.reason, on, gid]);
    };
    const diffFromT = (d: string) => Math.round((new Date(d).getTime() - new Date(T).getTime()) / 86_400_000);

    await addChange(gA, 'АСД', 1, 0, 'room', { new_room: 'К2-110', reason: 'В К1-305 меняют проектор — лекция пройдёт в К2-110.' });
    await addChange(gA, 'ДМ', 4, 0, 'moved', { new_date: '6', new_slot: 2, reason: 'Ушаков П. Л. на олимпиаде — практика переносится на субботу, 2-я пара.' });
    await addChange(gA, 'ENG', 2, 1, 'teacher', { new_teacher: 'Корнилова Е. Д.', reason: 'Замена на одно занятие.' });
    await addChange(gA, 'ВЕБ', 4, 1, 'cancelled', { reason: 'Лекция отменена: Ларин Е. С. на конференции. Материал — в курсе на портале.' });
    await addChange(gB, 'ЭКМ', 1, 0, 'moved', { new_date: '3', new_slot: 5, reason: 'Лекция по эконометрике переносится на среду, 5-я пара.' });
    await addChange(gB, 'КФ', 2, 0, 'room', { new_room: 'Э-108', reason: 'Семинар в Э-108 вместо Э-215.' });
    await addChange(gB, 'МАК', 4, 1, 'cancelled', { reason: 'Семинар отменён, задачи — в электронном курсе.' });

    // Зачётная книжка прошлых семестров
    const rb = async (uid: string, sem: number, disc: string, control: string, result: string, points: number | null, credits: number, teacher: string, date: string) =>
      c.query(`INSERT INTO record_book(student_id,semester,discipline,control,result,points,credits,teacher,passed_on) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [uid, sem, disc, control, result, points, credits, teacher, date]);
    for (const r of [
      [1, 'Программирование на Python', 'Экзамен', 'отлично', 94, 5, 'Ларин Е. С.', '2026-01-16'], [1, 'Линейная алгебра', 'Экзамен', 'отлично', 88, 5, 'Белозёрова Т. М.', '2026-01-21'],
      [1, 'Введение в специальность', 'Зачёт', 'зачтено', 81, 2, 'Соколов Д. А.', '2025-12-24'], [1, 'История России', 'Дифф. зачёт', 'хорошо', 79, 3, 'Гришин В. В.', '2025-12-26'],
      [1, 'Английский язык', 'Зачёт', 'зачтено', 90, 2, 'Миронова А. В.', '2025-12-23'],
      [2, 'Объектно-ориентированное программирование', 'Экзамен', 'отлично', 96, 5, 'Соколов Д. А.', '2026-06-15'], [2, 'Математический анализ, ч. 1', 'Экзамен', 'отлично', 86, 5, 'Белозёрова Т. М.', '2026-06-19'],
      [2, 'Архитектура компьютеров', 'Экзамен', 'хорошо', 83, 4, 'Ушаков П. Л.', '2026-06-24'], [2, 'Английский язык', 'Зачёт', 'зачтено', 92, 2, 'Миронова А. В.', '2026-06-05'],
      [2, 'Учебная практика', 'Дифф. зачёт', 'отлично', 95, 3, 'Ларин Е. С.', '2026-07-03'],
    ] as const) await rb(uA, ...(r as unknown as [number, string, string, string, number, number, string, string]));
    for (const r of [
      [1, 'Микроэкономика', 'Экзамен', 'хорошо', 78, 5, 'Полякова О. Н.', '2025-01-17'], [1, 'Высшая математика', 'Экзамен', 'удовлетворительно', 61, 5, 'Белозёрова Т. М.', '2025-01-22'],
      [1, 'Информатика', 'Зачёт', 'зачтено', 88, 3, 'Ларин Е. С.', '2024-12-25'],
      [2, 'Макроэкономика', 'Экзамен', 'хорошо', 74, 5, 'Полякова О. Н.', '2025-06-16'], [2, 'Теория вероятностей', 'Экзамен', 'удовлетворительно', 58, 4, 'Руденко В. П.', '2025-06-20'],
      [2, 'Английский язык', 'Зачёт', 'зачтено', 85, 2, 'Миронова А. В.', '2025-06-06'],
      [3, 'Бухгалтерский учёт', 'Экзамен', 'хорошо', 80, 4, 'Шестакова И. Ю.', '2026-01-15'], [3, 'Деньги, кредит, банки', 'Экзамен', 'отлично', 87, 4, 'Ахмеров Р. Ф.', '2026-01-19'],
      [3, 'Мировая экономика', 'Дифф. зачёт', 'хорошо', 76, 3, 'Полякова О. Н.', '2026-01-23'],
      [4, 'Статистика', 'Экзамен', 'неудовлетворительно', 41, 5, 'Руденко В. П.', '2026-06-18'], [4, 'Финансы', 'Экзамен', 'хорошо', 72, 4, 'Ахмеров Р. Ф.', '2026-06-22'],
      [4, 'Производственная практика', 'Дифф. зачёт', 'отлично', 90, 3, 'Ахмеров Р. Ф.', '2026-07-10'],
    ] as const) await rb(uB, ...(r as unknown as [number, string, string, string, number, number, string, string]));

    // Новости и объявления деканата
    const news = async (title: string, body: string, opts: { important?: boolean; faculty?: number; group?: number; link?: string; hoursAgo: number; author?: string }) =>
      c.query(`INSERT INTO notifications(kind,title,body,link,important,faculty_id,group_id,author,created_at) VALUES ('news',$1,$2,$3,$4,$5,$6,$7, now() - ($8 || ' hours')::interval)`,
        [title, body, opts.link ?? null, opts.important ?? false, opts.faculty ?? null, opts.group ?? null, opts.author ?? 'Деканат', String(opts.hoursAgo)]);
    await news('Опубликовано расписание зимней сессии', 'Экзамены пройдут с 11 по 30 января. Даты и аудитории уже в разделе «Расписание → Сессия». Консультации — накануне каждого экзамена.', { important: true, link: '/schedule?tab=session', hoursAgo: 20 });
    await news('Повышенная стипендия: приём документов до 30 ноября', 'Заявление подаётся онлайн в разделе «Заявки». Портфолио достижений прикрепите в электронном курсе «Стипендиальная комиссия».', { hoursAgo: 46, link: '/requests' });
    await news('Неделя карьеры 23–28 ноября', 'Встречи с работодателями, разбор резюме и пробные собеседования. Регистрация — у куратора группы.', { hoursAgo: 70 });
    await news('Медосмотр для вторых курсов', 'Пройти нужно до 12 декабря в медпункте корпуса К2, каб. 104. Возьмите полис ОМС.', { faculty: fkn, hoursAgo: 30 });
    await news('Хакатон факультета 29 ноября', 'Команды 2–4 человека, тема — сервисы для студентов. Регистрация до 25 ноября.', { faculty: fkn, hoursAgo: 90, author: 'Студсовет ФКН' });
    await news('Пересдачи по графику: 23–28 ноября', 'Студенты с академическими задолженностями берут направление на пересдачу онлайн в разделе «Заявки». Без направления к пересдаче не допускают.', { faculty: ef, important: true, hoursAgo: 26, link: '/requests' });
    await news('Встреча с банком «Северный»', 'Стажировки для 3–4 курсов профиля «Финансы и кредит», 25 ноября, 16:15, ауд. Э-401.', { faculty: ef, hoursAgo: 60 });
    await news('Староста собирает данные для зачётной недели', 'Проверьте в профиле, что почта и телефон указаны верно.', { group: gA, hoursAgo: 8, author: 'Староста ПИ-25-1', link: '/profile' });

    // Заявки с историей
    const reqIns = async (uid: string, type: string, title: string, payload: object, status: string, events: [string, string | null, string, number][], verify = false) => {
      const no = (await c.query(`SELECT nextval('request_no') AS n`)).rows[0].n;
      const first = events[0][3], last = events[events.length - 1][3];
      const r = (await c.query(`INSERT INTO requests(number,student_id,type,title,payload,status,verify_code,due_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7, now() + interval '2 days', now() - ($8 || ' hours')::interval, now() - ($9 || ' hours')::interval) RETURNING id`,
        [`З-${2026}-${String(no).padStart(4, '0')}`, uid, type, title, JSON.stringify(payload), status, verify ? randomToken(9) : null, String(first), String(last)])).rows[0].id;
      for (const [st, comment, actor, h] of events) {
        await c.query(`INSERT INTO request_events(request_id,status,comment,actor_role,actor_name,created_at) VALUES ($1,$2,$3,$4,$5, now() - ($6 || ' hours')::interval)`,
          [r, st, comment, actor === 'student' ? 'student' : 'staff', actor === 'student' ? 'Вы' : 'Лаврова О. С.', String(h)]);
      }
      return r;
    };
    await reqIns(uA, 'study_cert', 'Справка об обучении', { place: 'Банк', format: 'Электронная с QR', copies: 1 }, 'ready',
      [['submitted', null, 'student', 30], ['review', null, 'staff', 26], ['preparing', null, 'staff', 25], ['ready', 'Справка подписана электронной подписью. Скачайте PDF или покажите QR в банке.', 'staff', 22]], true);
    await reqIns(uA, 'individual_plan', 'Индивидуальный график', { reason: 'Спортивные сборы', comment: 'Сборы сборной университета по ориентированию 1–14 декабря.' }, 'review',
      [['submitted', null, 'student', 20], ['review', 'Передали на согласование заведующему кафедрой.', 'staff', 6]]);
    await reqIns(uA, 'stipend_cert', 'Справка о стипендии', { period: '6 месяцев', format: 'Бумажная с печатью' }, 'done',
      [['submitted', null, 'student', 400], ['review', null, 'staff', 380], ['preparing', null, 'staff', 370], ['ready', 'Забрать можно в К1-214.', 'staff', 340], ['done', 'Выдано лично.', 'staff', 300]]);
    await reqIns(uB, 'retake', 'Направление на пересдачу', { discipline: 'Статистика', date: D(12) }, 'needs_info',
      [['submitted', null, 'student', 28], ['review', null, 'staff', 24], ['needs_info', 'Руденко В. П. принимает пересдачи 24 и 27 ноября. Ответьте, какая дата вам подходит — оформим направление.', 'staff', 3]]);
    await reqIns(uB, 'military_cert', 'Справка в военкомат', { commissariat: 'Северный район', copies: 1 }, 'preparing',
      [['submitted', null, 'student', 50], ['review', null, 'staff', 40], ['preparing', 'Ждём подпись проректора, обычно это 1–2 дня.', 'staff', 18]]);
    await reqIns(uB, 'question', 'Вопрос в деканат', { topic: 'Стипендия', text: 'Если закрою пересдачу, можно вернуть стипендию со следующего месяца?' }, 'done',
      [['submitted', null, 'student', 120], ['ready', 'Да: после ликвидации задолженности и без троек в зимнюю сессию стипендия назначается с февраля.', 'staff', 100], ['done', null, 'staff', 99]]);

    await reqIns(uB, 'call_cert', 'Справка-вызов', { employer: 'ООО «Северный ветер»' }, 'submitted',
      [['submitted', null, 'student', 2]]);

    // уведомления по заявкам
    await c.query(`INSERT INTO notifications(kind,title,body,link,user_id,author,created_at) VALUES
      ('request','Справка об обучении готова','Скачайте PDF с QR-кодом — банк проверит его онлайн.','/requests',$1,'Деканат', now() - interval '22 hours'),
      ('request','Деканату нужно уточнение','Заявка на пересдачу: выберите дату — 24 или 27 ноября.','/requests',$2,'Деканат', now() - interval '3 hours')`, [uA, uB]);
  });
  console.log('seed: ok (логины vetrova, galeev, dekanat)');
}

main().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
