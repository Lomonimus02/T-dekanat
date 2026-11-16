# Архитектура

```
Браузер ──HTTPS──► Caddy (stellarschool.ru, Let's Encrypt)
                     ├─ /dekanat, /dekanat/*  ──► 127.0.0.1:4520  pm2 «stellar-dekanat» (Node 22, Express 5)
                     └─ всё остальное         ──► 127.0.0.1:5443  pm2 «stellar» (основной сайт, без изменений)
stellar-dekanat ──► PostgreSQL 16 (127.0.0.1:5432), отдельная БД и роль «dekanat»
```

## Связь со Stellar School

`stellarschool.ru` — рабочая школьная система Stellar School (React + Vite + Tailwind/shadcn, Express,
Drizzle, PostgreSQL, Passport), разворачиваемая из GitHub вебхуком. Кабинет деканата взял от неё:
стек (React/Vite/Express/PostgreSQL/TypeScript), архитектуру «SPA + REST API под одним Express»,
сессионную модель с cookie и бренд Stellar с изумрудно-индиговой палитрой; он открыт под тем же доменом.
Код и база основного сайта не изменялись: деплой из GitHub делает `git reset --hard`, а в
конкурсной работе разрешены только вымышленные данные. Поэтому деканат — отдельное приложение и
отдельная БД, подключённые к сайту одним дополнительным блоком `handle` в Caddy.

## Каталоги

| Путь | Что там |
|---|---|
| `shared/` | общий для клиента и сервера код: учебные пары и семестр (`time.ts`), БРС (`grading.ts`), типы и статусы заявок с допустимыми переходами (`requests.ts`) |
| `server/schema.ts` | миграции (таблица `migrations`) |
| `server/auth.ts` | вход, сессии, лимит попыток, middleware ролей и CSRF |
| `server/lib/data.ts` | все выборки студента: профиль, расписание с изменениями, дисциплины и прогноз, зачётка, сводка, уведомления |
| `server/lib/digest.ts` | события недели для главной: «Требует внимания», «Изменения в расписании», «Ближайшие дедлайны» |
| `server/lib/assistant.ts` | поиск (Ctrl+K) — ответы по правилам на данных студента |
| `server/routes/` | `public.ts` (вход, проверка справки), `student.ts`, `staff.ts` |
| `server/seed.ts` | вымышленные данные; даты считаются от дня запуска |
| `client/src/pages/Home.tsx` (`SubjectsTable`) | «Дисциплины семестра»: баллы, порог допуска, прогноз, ближайшая сдача |
| `client/src/components/Stories.tsx` | «Истории» деканата на главной и полноэкранный просмотр |
| `client/src/pages/` | страницы |
| `client/src/styles/` | дизайн-система (`app.css`) и стили страниц (`pages.css`) |
| `tests/` | `security.test.mjs`, `screenshots.mjs` |

## Данные

`users` (логин, bcrypt-хеш, роль) → `students` / `staff`. `faculties`, `groups`, `disciplines`
(на группу, с формой контроля и з. е.), `lessons` (регулярные пары с чётностью), `lesson_changes`
(замена аудитории/преподавателя, отмена, перенос), `control_points` + `scores`, `attendance`, `exams`,
`record_book` (прошлые семестры), `requests` + `request_events` (история и переписка),
`notifications` (адресаты: всем / факультету / курсу / группе / студенту) + `notification_reads`,
`sessions`, `login_attempts`, `audit_log`.

## Расписание

Расписание строится из регулярных пар по чётности недели, затем накладываются изменения на дату.
Перенос даёт две записи: «перенесено отсюда» (moved_out) и «перенесено сюда» (moved_in).

## Оценки

Семестр — до 60 баллов, экзамен/зачёт — до 40. Допуск ≥ 30 баллов. Итог: ≥ 85 «отлично»,
≥ 70 «хорошо», ≥ 55 «удовлетворительно». Прогноз — текущий темп по сданным работам, перенесённый на
оставшиеся. Стипендия под вопросом, если в прогнозе есть «удовлетворительно» или долг.

## Деплой

- Код: `/opt/stellar-dekanat` (`dist/` — собранный клиент и самодостаточный сервер, `src/` — исходники, `.env` — секреты, chmod 600).
- Процесс: pm2 `stellar-dekanat` (`ecosystem.config.cjs`), автозапуск через `pm2-root`, перезапуск при падении и при >220 МБ.
- Демо-данные пересоздаются каждую ночь в 04:30 МСК (`/etc/cron.d/stellar-dekanat`), чтобы «сегодня» и дедлайны оставались актуальными.
- Caddy: блок `@dekanat` в `/etc/caddy/sites/stellarschool.ru.caddy`.
