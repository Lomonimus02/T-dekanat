// Автотест разделения данных: студент A не может прочитать или изменить данные студента B.
// Запуск: BASE=https://stellarschool.ru/dekanat node tests/security.test.mjs
const BASE = process.env.BASE ?? 'http://127.0.0.1:4520/dekanat';
const H = { 'X-Requested-With': 'stellar', 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const results = [];

async function login(l, p) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ login: l, password: p }) });
  if (!r.ok) throw new Error(`login ${l}: ${r.status}`);
  return r.headers.get('set-cookie').split(';')[0];
}
const call = (cookie, path, opts = {}) => fetch(`${BASE}/api${path}`, { ...opts, headers: { ...H, ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers ?? {}) } });
function expect(name, got, want) {
  const ok = Array.isArray(want) ? want.includes(got) : got === want;
  ok ? pass++ : fail++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${got}${ok ? '' : ` (ожидали ${want})`}`);
}

const A = await login('vetrova', 'Orbita-2026');
const B = await login('galeev', 'Kometa-2026');
const S = await login('dekanat', 'Zvezda-2026');

const bMe = await (await call(B, '/auth/me')).json();
const bReqs = await (await call(B, '/requests')).json();
const bGrades = await (await call(B, '/grades')).json();
const bSessions = await (await call(B, '/me/sessions')).json();
const bNotes = await (await call(B, '/notifications')).json();
const bReq = bReqs[0].id;
const bDoc = bReqs.find((r) => r.electronic)?.id ?? bReq;
const bDisc = bGrades.disciplines[0].id;
const bPersonal = bNotes.items.find((n) => n.personal)?.id;

expect('A читает заявку B (GET /requests/:id)', (await call(A, `/requests/${bReq}`)).status, 404);
expect('A открывает документ B', (await call(A, `/requests/${bDoc}/document`)).status, 404);
expect('A отвечает в заявке B', (await call(A, `/requests/${bReq}/reply`, { method: 'POST', body: JSON.stringify({ text: 'взлом' }) })).status, 404);
expect('A отменяет заявку B', (await call(A, `/requests/${bReq}/cancel`, { method: 'POST' })).status, 404);
expect('A читает профиль B (GET /students/:id/profile)', (await call(A, `/students/${bMe.id}/profile`)).status, 403);
expect('A читает дисциплину/оценки группы B', (await call(A, `/grades/${bDisc}`)).status, 404);
expect('A завершает сеанс B', (await call(A, `/me/sessions/${bSessions[0].id}`, { method: 'DELETE' })).status, 404);
if (bPersonal) {
  const r = await (await call(A, '/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [bPersonal] }) })).json();
  expect('A помечает прочитанным личное уведомление B (marked)', r.marked, 0);
}
const aList = await (await call(A, '/requests')).json();
expect('В списке заявок A нет заявок B', aList.some((r) => bReqs.some((x) => x.id === r.id)) ? 'есть чужие' : 'только свои', 'только свои');
const aProfile = await (await call(A, '/me/profile')).json();
expect('Профиль A — это A', aProfile.login, 'vetrova');
expect('Студент открывает API сотрудника', (await call(A, '/staff/requests')).status, 403);
expect('Студент меняет статус заявки через API сотрудника', (await call(A, `/staff/requests/${bReq}/status`, { method: 'POST', body: JSON.stringify({ status: 'ready' }) })).status, 403);
expect('Сотрудник открывает студенческий API (/home)', (await call(S, '/home')).status, 403);
expect('Без входа: /home', (await call(null, '/home')).status, 401);
expect('Без входа: /requests/:id', (await call(null, `/requests/${bReq}`)).status, 401);
expect('Подделанная cookie', (await call('sd_sid=forged-token-value-1234567890', '/home')).status, 401);
expect('CSRF: POST без заголовка X-Requested-With', (await fetch(`${BASE}/api/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: A }, body: '{}' })).status, 403);
expect('CSRF: POST с чужим Origin', (await call(A, '/requests', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ type: 'question', fields: {} }) })).status, 403);
expect('Неверный пароль', (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ login: 'probe-nobody', password: 'wrong' }) })).status, 401);
expect('Неверный тип заявки', (await call(A, '/requests', { method: 'POST', body: JSON.stringify({ type: 'hack', fields: {} }) })).status, 400);
expect('Недопустимое значение поля', (await call(A, '/requests', { method: 'POST', body: JSON.stringify({ type: 'study_cert', fields: { place: '<script>', format: 'Электронная с QR', copies: 1 } }) })).status, 400);
const loginRes = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ login: 'vetrova', password: 'Orbita-2026' }) });
const sc = loginRes.headers.get('set-cookie') ?? '';
expect('Cookie сессии HttpOnly', /HttpOnly/i.test(sc), true);
expect('Cookie сессии SameSite=Lax', /SameSite=Lax/i.test(sc), true);
if (BASE.startsWith('https')) expect('Cookie сессии Secure', /Secure/i.test(sc), true);
const page = await fetch(`${BASE}/login`);
expect('Заголовок Content-Security-Policy', !!page.headers.get('content-security-policy'), true);
expect('Заголовок X-Frame-Options/frame-ancestors', /frame-ancestors 'none'/.test(page.headers.get('content-security-policy') ?? ''), true);
const html = await page.text();
const loginCookie = sc.split(';')[0];

// Проверка через URL в браузере: A открывает адрес заявки B
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' });
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/login`);
  await pg.fill('input[autocomplete=username]', 'vetrova'); await pg.fill('input[type=password]', 'Orbita-2026');
  await pg.click('form button.btn-primary');
  await pg.waitForURL((u) => !u.pathname.endsWith('/login'));
  await pg.goto(`${BASE}/requests/${bReq}`);
  await pg.waitForTimeout(1500);
  const txt = await pg.textContent('main');
  expect('URL: A открывает /requests/<id заявки B> в браузере', /не найдена/i.test(txt) && !txt.includes(bReqs[0].number) ? 'не найдена' : 'ВИДНО', 'не найдена');
  await pg.goto(`${BASE}/requests/${bDoc}/document`);
  await pg.waitForTimeout(1500);
  const txt2 = await pg.textContent('body');
  expect('URL: A открывает документ B в браузере', txt2.includes('Галеев') ? 'ВИДНО' : 'скрыто', 'скрыто');
  await pg.evaluate(() => fetch('/dekanat/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'stellar' } }));
  await browser.close();
} catch (e) { console.log('UI-часть пропущена:', e.message); }

for (const c of [A, B, S, loginCookie]) await call(c, '/auth/logout', { method: 'POST' });
expect('В HTML нет секретов из .env', /SESSION_SECRET|DATA_KEY|DATABASE_URL|postgres:\/\//.test(html), false);

console.log(results.join('\n'));
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
