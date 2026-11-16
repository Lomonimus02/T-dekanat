// Каталог заявок. Один источник правды для формы, сервера и кабинета сотрудника.
export type FieldDef =
  | { name: string; label: string; type: 'select'; options: string[]; required?: boolean }
  | { name: string; label: string; type: 'text' | 'textarea' | 'date'; placeholder?: string; required?: boolean; max?: number }
  | { name: string; label: string; type: 'number'; min: number; max: number; required?: boolean }
  | { name: string; label: string; type: 'discipline'; required?: boolean };

export type RequestType = {
  id: string;
  group: 'cert' | 'statement' | 'contact';
  title: string;
  short: string;
  eta: string;
  etaDays: number;
  electronic?: boolean;
  fields: FieldDef[];
};

export const REQUEST_TYPES: RequestType[] = [
  {
    id: 'study_cert', group: 'cert', title: 'Справка об обучении', short: 'По месту требования: работа, банк, соцзащита', eta: '1 рабочий день', etaDays: 1, electronic: true,
    fields: [
      { name: 'place', label: 'Куда нужна', type: 'select', options: ['Работа', 'Банк', 'Соцзащита', 'Пенсионный фонд', 'Налоговая', 'Другое'], required: true },
      { name: 'format', label: 'Формат', type: 'select', options: ['Электронная с QR', 'Бумажная с печатью'], required: true },
      { name: 'copies', label: 'Экземпляров', type: 'number', min: 1, max: 5, required: true },
    ],
  },
  {
    id: 'military_cert', group: 'cert', title: 'Справка в военкомат', short: 'Форма № 4 для отсрочки', eta: '3 рабочих дня', etaDays: 3,
    fields: [
      { name: 'commissariat', label: 'Военкомат', type: 'text', placeholder: 'Например, Центральный район', required: true, max: 120 },
      { name: 'copies', label: 'Экземпляров', type: 'number', min: 1, max: 3, required: true },
    ],
  },
  {
    id: 'stipend_cert', group: 'cert', title: 'Справка о стипендии', short: 'Размер выплат за выбранный период', eta: '2 рабочих дня', etaDays: 2, electronic: true,
    fields: [
      { name: 'period', label: 'Период', type: 'select', options: ['3 месяца', '6 месяцев', '12 месяцев'], required: true },
      { name: 'format', label: 'Формат', type: 'select', options: ['Электронная с QR', 'Бумажная с печатью'], required: true },
    ],
  },
  {
    id: 'call_cert', group: 'cert', title: 'Справка-вызов', short: 'Учебный отпуск на работе на время сессии', eta: '2 рабочих дня', etaDays: 2,
    fields: [
      { name: 'employer', label: 'Работодатель', type: 'text', placeholder: 'Название организации', required: true, max: 160 },
    ],
  },
  {
    id: 'retake', group: 'statement', title: 'Направление на пересдачу', short: 'Экзаменационный лист для ликвидации долга', eta: '1 рабочий день', etaDays: 1,
    fields: [
      { name: 'discipline', label: 'Дисциплина', type: 'discipline', required: true },
      { name: 'date', label: 'Желаемая дата', type: 'date', required: true },
    ],
  },
  {
    id: 'individual_plan', group: 'statement', title: 'Индивидуальный график', short: 'Свободное посещение из-за работы, спорта или здоровья', eta: '5 рабочих дней', etaDays: 5,
    fields: [
      { name: 'reason', label: 'Причина', type: 'select', options: ['Работа по профилю', 'Спортивные сборы', 'Состояние здоровья', 'Семейные обстоятельства'], required: true },
      { name: 'comment', label: 'Пояснение', type: 'textarea', placeholder: 'Коротко: сроки и что подтверждает причину', max: 600 },
    ],
  },
  {
    id: 'material_aid', group: 'statement', title: 'Материальная помощь', short: 'Разовая выплата из стипендиального фонда', eta: '10 рабочих дней', etaDays: 10,
    fields: [
      { name: 'reason', label: 'Основание', type: 'select', options: ['Трудная жизненная ситуация', 'Рождение ребёнка', 'Лечение', 'Другое'], required: true },
      { name: 'comment', label: 'Пояснение', type: 'textarea', placeholder: 'Что произошло и какие документы есть', max: 600 },
    ],
  },
  {
    id: 'academic_leave', group: 'statement', title: 'Академический отпуск', short: 'Перерыв в учёбе с сохранением места', eta: '10 рабочих дней', etaDays: 10,
    fields: [
      { name: 'reason', label: 'Основание', type: 'select', options: ['Медицинские показания', 'Семейные обстоятельства', 'Призыв на службу'], required: true },
      { name: 'date', label: 'С какой даты', type: 'date', required: true },
    ],
  },
  {
    id: 'question', group: 'contact', title: 'Вопрос в деканат', short: 'Ответ придёт сюда же, без очереди у двери', eta: 'обычно за день', etaDays: 1,
    fields: [
      { name: 'topic', label: 'Тема', type: 'select', options: ['Учебный план', 'Стипендия', 'Расписание', 'Документы', 'Другое'], required: true },
      { name: 'text', label: 'Вопрос', type: 'textarea', placeholder: 'Опишите ситуацию', required: true, max: 1000 },
    ],
  },
];

export const STATUS_FLOW = ['submitted', 'review', 'preparing', 'ready', 'done'] as const;
export type Status = 'submitted' | 'review' | 'preparing' | 'needs_info' | 'ready' | 'done' | 'rejected';

export const STATUS_LABEL: Record<Status, string> = {
  submitted: 'Отправлена',
  review: 'На проверке',
  preparing: 'Готовится',
  needs_info: 'Нужно уточнение',
  ready: 'Готово',
  done: 'Выдано',
  rejected: 'Отклонена',
};

export const STATUS_HINT: Record<Status, string> = {
  submitted: 'Заявка в очереди деканата',
  review: 'Специалист проверяет данные',
  preparing: 'Документ оформляется и подписывается',
  needs_info: 'Деканату нужен ваш ответ',
  ready: 'Можно скачать или забрать',
  done: 'Документ у вас',
  rejected: 'Заявку не удалось выполнить',
};

export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  submitted: ['review', 'needs_info', 'rejected'],
  review: ['preparing', 'needs_info', 'ready', 'rejected'],
  preparing: ['ready', 'needs_info', 'rejected'],
  needs_info: ['review', 'rejected'],
  ready: ['done'],
  done: [],
  rejected: [],
};

export function typeById(id: string) {
  return REQUEST_TYPES.find((t) => t.id === id);
}
