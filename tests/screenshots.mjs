// Скриншоты всех страниц на 4 ширинах + автопроверки: горизонтальный скролл, вылезающие элементы, ошибки консоли.
// Запуск: BASE=https://stellarschool.ru/dekanat node tests/screenshots.mjs [фильтр]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4520/dekanat';
const OUT = process.env.OUT ?? 'screenshots';
const WIDTHS = (process.env.WIDTHS ?? '360,390,768,1440').split(',').map(Number);
const only = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const ACC = { vetrova: 'Orbita-2026', galeev: 'Kometa-2026', dekanat: 'Zvezda-2026' };
const STUDENT_PAGES = [
  ['home', '/'], ['schedule', '/schedule'], ['session', '/schedule?tab=session'],
  ['grades', '/grades'], ['book', '/grades?tab=book'], ['discipline', 'FIRST_DISC'], ['requests', '/requests'], ['new', '/requests/new'],
  ['new-cert', '/requests/new/study_cert'], ['request', 'FIRST_REQ'], ['notifications', '/notifications'], ['profile', '/profile'], ['navigator', 'NAV'], ['more', 'MORE'], ['document', 'DOC'],
];
const STAFF_PAGES = [['staff', '/staff'], ['staff-more', 'MORE'], ['staff-request', 'FIRST_STAFF_REQ'], ['staff-ann', '/staff/announcements']];

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const problems = [];

async function check(page, name) {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const issues = [];
    if (document.documentElement.scrollWidth > vw + 1) issues.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${vw}`);
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.closest('svg') || el.closest('.seg') || el.closest('.hscroll') || el.closest('.rem-row') || el.closest('.gpa') || el.closest('.login-art') || el.closest('.sr-only') || el.classList.contains('sr-only')) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const pan = el.parentElement?.closest('.panel, .dialog, .paper');
      if (pan && !el.classList.contains('paper-watermark')) {
        const pb = pan.getBoundingClientRect(); const ps = getComputedStyle(pan);
        const inL = pb.left + parseFloat(ps.paddingLeft) - 1, inR = pb.right - parseFloat(ps.paddingRight) + 1;
        if ((b.right > inR + 1 || b.left < inL - 1) && !el.closest('.feed-panel')) issues.push(`outside panel padding: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(b.left)}..${Math.round(b.right)} panel ${Math.round(inL)}..${Math.round(inR)} "${(el.textContent || '').trim().slice(0, 30)}"`);
      }
      if (b.right > vw + 1 || b.left < -1) issues.push(`overflow x: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(b.left)}..${Math.round(b.right)} (vw ${vw}) "${(el.textContent || '').trim().slice(0, 40)}"`);
      if (issues.length > 12) break;
    }
    for (const sg of document.querySelectorAll('.seg')) if (sg.scrollWidth > sg.clientWidth + 1) issues.push(`segmented control scrolls: "${sg.textContent.trim().slice(0, 40)}"`);
    // текст, обрезанный без многоточия
    for (const el of document.querySelectorAll('h1,h2,h3,b,button,a,span,div,p')) {
      if (el.children.length || el.closest('.sr-only')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || el.closest('svg') || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
      if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && !String(cs.webkitLineClamp).match(/\d/) && !['auto', 'scroll'].includes(cs.overflowX)) issues.push(`text overflows box (${cs.overflow}): "${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
    }
    for (const el of document.querySelectorAll('.tab span, .nav-item span, .panel-title .h2')) if (el.scrollWidth > el.clientWidth + 1) issues.push(`label truncated: "${el.textContent.trim()}"`);
    // зоны нажатия на телефоне и планшете
    if (vw < 1024) for (const el of document.querySelectorAll('.btn, .icon-btn, .tab, .more-item, .filter-chips button, .seg button, .topbar-back, .nav-item')) {
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!b.width || cs.visibility === 'hidden' || el.closest('.rail')) continue;
      const min = el.closest('.seg') ? 40 : 44;
      if (b.height < min - 0.5) issues.push(`tap target ${Math.round(b.width)}x${Math.round(b.height)}: "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`);
    }
    return issues;
  });
  if (r.length) problems.push({ name, issues: r });
}

// Полная страница без «висящих» fixed-панелей: растягиваем окно на всю высоту и снимаем окно целиком
async function shoot(page, file, w) {
  const baseH = w < 700 ? 800 : 900;
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: w, height: Math.min(Math.max(h, baseH), 7000) });
  await page.waitForTimeout(150);
  await page.screenshot({ path: file });
  await page.setViewportSize({ width: w, height: baseH });
}

async function run(login, pages) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 800 : 900 }, deviceScaleFactor: w < 700 ? 2 : 1, locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.text().includes('401') && m.location()?.url?.includes('auth/me'))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    if (!only || 'login'.includes(only)) { await shoot(page, `${OUT}/${login}-login-${w}.png`, w); await check(page, `${login}-login-${w}`); }
    await page.fill('input[autocomplete=username]', login);
    await page.fill('input[type=password]', ACC[login]);
    await page.click('form button.btn-primary');
    await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
    const ids = await page.evaluate(async () => {
      const h = { 'X-Requested-With': 'stellar' };
      const me = await (await fetch('/dekanat/api/auth/me', { headers: h })).json();
      if (me.role === 'staff') { const l = await (await fetch('/dekanat/api/staff/requests?status=all', { headers: h })).json(); return { staffReq: l[0]?.id }; }
      const g = await (await fetch('/dekanat/api/grades', { headers: h })).json();
      const r = await (await fetch('/dekanat/api/requests', { headers: h })).json();
      const risky = g.disciplines.find((d) => d.state !== 'ok') ?? g.disciplines[0];
      const doc = r.find((x) => x.electronic && ['ready', 'done'].includes(x.status));
      const act = r.find((x) => ['needs_info', 'review', 'preparing', 'ready'].includes(x.status)) ?? r[0];
      return { disc: risky?.id, req: act?.id, doc: doc?.id };
    });
    for (const [name, path] of pages) {
      if (only && !name.includes(only)) continue;
      let url = path;
      if (path === 'FIRST_DISC') url = `/grades/${ids.disc}`;
      if (path === 'FIRST_REQ') url = `/requests/${ids.req}`;
      if (path === 'FIRST_STAFF_REQ') url = `/staff/requests/${ids.staffReq}`;
      if (path === 'DOC') { if (!ids.doc) continue; url = `/requests/${ids.doc}/document`; }
      if (path === 'NAV') url = '/';
      if (path === 'MORE') { if (w >= 1024) continue; url = login === 'dekanat' ? '/staff' : '/'; }
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(350);
      if (path === 'NAV') {
        await page.keyboard.press('Control+k');
        await page.waitForSelector('[role=dialog] input');
        await page.fill('[role=dialog] input', 'Что сдать на этой неделе?');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => !document.querySelector('[role=dialog]')?.textContent?.includes('Считаю'), null, { timeout: 15000 });
        await page.waitForTimeout(200);
      }
      if (path === 'MORE') { await page.click('.tabbar button.tab'); await page.waitForSelector('[role=dialog] .more'); await page.waitForTimeout(300); }
      const file = `${OUT}/${login}-${name}-${w}.png`;
      if (path === 'NAV' || path === 'MORE') await page.screenshot({ path: file });
      else await shoot(page, file, w);
      await check(page, `${login}-${name}-${w}`);
    }
    if (errors.length) problems.push({ name: `${login}-${w} console`, issues: [...new Set(errors)] });
    await page.evaluate(() => fetch('/dekanat/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'stellar' } })).catch(() => {});
    await ctx.close();
  }
}

const who = process.env.WHO ? process.env.WHO.split(',') : ['vetrova', 'galeev', 'dekanat'];
for (const l of who) await run(l, l === 'dekanat' ? STAFF_PAGES : STUDENT_PAGES);
await browser.close();
fs.writeFileSync(`${OUT}/_problems.json`, JSON.stringify(problems, null, 2));
console.log(problems.length ? JSON.stringify(problems, null, 2) : 'NO PROBLEMS');
