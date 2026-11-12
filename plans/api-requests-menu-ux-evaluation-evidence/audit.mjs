// API 요청 메뉴 약식 점검 증거 수집. 인프라 점검의 audit.mjs/audit2.mjs와 같은 방식.
// 실행: node audit.mjs (데모를 127.0.0.1:5211/everyup/demo/ 에 띄운 뒤). 결과는 ./cap/
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const tools = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules');
const { chromium } = await import(pathToFileURL(path.join(tools, 'playwright/index.mjs')));
const axePath = path.join(tools, 'axe-core/axe.min.js');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cap');
await fs.mkdir(out, { recursive: true });
const demo = 'http://127.0.0.1:5211/everyup/demo/';
const browser = await chromium.launch({ headless: true });
const notes = {};
const mask = s => (s ?? '').replace(/evup_[A-Za-z0-9_-]{6,}/g, 'evup_[MASKED]');

async function ctx(width = 1440, theme = 'light', scenario = 'attention') {
  const c = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: theme, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
  await c.addInitScript(({ theme, scenario }) => { localStorage.setItem('theme', theme); sessionStorage.setItem('everyup_demo_scenario', scenario); }, { theme, scenario });
  c.setDefaultTimeout(7000);
  return c;
}
async function go(page, route) { await page.goto(demo + route); await page.waitForTimeout(1000); }
const scrollTo = (p, y) => p.locator('main > div.overflow-y-auto').evaluate((e, y) => { e.scrollTop = y; }, y).catch(() => {});
async function axe(page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ') + ' | ' + (n.any[0]?.message ?? '')) })));
}
async function shot(page, id, { runAxe = false, full = true } = {}) {
  await page.screenshot({ path: path.join(out, id + '.png'), fullPage: full });
  const info = await page.evaluate(() => {
    const main = document.querySelector('dialog[open], [role=dialog]') ?? document.querySelector('main');
    return { text: main?.innerText?.slice(0, 3000), docW: document.documentElement.scrollWidth, vw: innerWidth,
      wideTables: [...document.querySelectorAll('main table')].map(t => ({ label: t.getAttribute('aria-label'), w: Math.round(t.scrollWidth), box: Math.round(t.parentElement.clientWidth) })),
      small: [...(main?.querySelectorAll('button,a,[role=button],[role=tab],select,input,tr[tabindex]') ?? [])].map(e => { const r = e.getBoundingClientRect(); return { l: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter(x => x.h > 0 && x.h < 24) };
  });
  info.text = mask(info.text);
  if (runAxe) info.axe = await axe(page);
  await fs.writeFile(path.join(out, id + '.json'), JSON.stringify(info, null, 2));
}
const positions = p => p.evaluate(() => [...document.querySelectorAll('main h1, main h2, main [role=tablist], main .recharts-wrapper, main table')].slice(0, 10)
  .map(e => `${e.tagName}:${(e.getAttribute('aria-label') || e.innerText || '').slice(0, 16).replace(/\n/g, ' ')}@${Math.round(e.getBoundingClientRect().top)}`));

// 1. 네 환경: 목록(카드·표), 상세(요청 탭), 트레이스 탭, 트레이스 패널
for (const [w, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
  const tag = `${w}-${theme}`;
  const c = await ctx(w, theme); const p = await c.newPage();
  await go(p, 'api?view=card'); await shot(p, `${tag}-list-card`, { runAxe: true });
  await go(p, 'api?view=grid'); await shot(p, `${tag}-list-grid`, { runAxe: w === 1440 });
  await go(p, 'api?view=card');
  await p.locator('main a[href*="/api/"]').first().click(); await p.waitForTimeout(1200);
  notes[`${tag}-detailUrl`] = p.url();
  await shot(p, `${tag}-detail`, { runAxe: true });
  if (w === 390) { await shot(p, `${tag}-detail-fold`, { full: false }); notes[`${tag}-positions`] = await positions(p); }
  await p.getByRole('tab', { name: '트레이스' }).click(); await p.waitForTimeout(900);
  await shot(p, `${tag}-traces`, { runAxe: theme === 'light' });
  await p.getByRole('tab', { name: 'API 요청' }).click(); await p.waitForTimeout(900);
  const row = p.getByRole('button', { name: /트레이스 상세 열기/ }).first();
  if (await row.count()) { await row.click(); await p.waitForTimeout(900); await shot(p, `${tag}-trace-panel`, { runAxe: theme === 'light', full: false }); }
  await c.close();
}

// 2. 데스크톱 라이트: 대상별 차이, 지표 전환, 툴팁, 키보드, 필터
{
  const c = await ctx(); const p = await c.newPage();
  for (const id of ['observed_mock_orders', 'observed_mock_inventory', 'observed_mock_search']) {
    await go(p, `api/${id}`);
    notes[`detail-${id}`] = (await p.locator('main').innerText()).slice(0, 900);
  }
  await go(p, 'api/observed_mock_orders');
  for (const label of ['에러율', '마지막 측정 구간 p95']) {
    const tile = p.getByRole('button', { name: new RegExp(label) }).first();
    if (await tile.count()) { await tile.click(); await p.waitForTimeout(400); await p.locator('main').getByText('서비스 전체 추이').first().scrollIntoViewIfNeeded(); await shot(p, `tile-${label === '에러율' ? 'error' : 'latency'}`, { full: false }); }
    else notes[`no-tile-${label}`] = true;
  }
  const chart = p.locator('main .recharts-wrapper').first();
  const box = await chart.boundingBox();
  if (box) { await p.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5); await p.waitForTimeout(300); await shot(p, 'tooltip', { full: false }); }
  // 키보드: Tab 순서와 차트 화살표 이동
  await go(p, 'api/observed_mock_orders');
  const seq = [];
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press('Tab');
    seq.push(await p.evaluate(() => { const e = document.activeElement; return `${e.tagName}${e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : ''}:${(e.getAttribute('aria-label') || e.innerText || e.className?.baseVal || e.className || '').toString().trim().slice(0, 40).replace(/\n/g, ' ')}`; }));
  }
  await fs.writeFile(path.join(out, 'tab-sequence.json'), JSON.stringify(seq, null, 2));
  const svg = p.locator('main .recharts-wrapper svg').first();
  await svg.focus().catch(() => {});
  notes.chartFocus = await p.evaluate(() => { const e = document.activeElement; return `${e.tagName} role=${e.getAttribute('role')} tabindex=${e.getAttribute('tabindex')}`; });
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(300);
  notes.chartTooltipAfterArrows = await p.locator('main .recharts-tooltip-wrapper').first().evaluate(e => getComputedStyle(e).visibility + ' ' + e.innerText.slice(0, 80)).catch(() => 'none');
  await shot(p, 'keyboard-chart', { full: false });
  // 필터: 에러만 + 검색 결과 없음
  await p.getByRole('button', { name: '에러만' }).click(); await p.waitForTimeout(700);
  await shot(p, 'filter-errors');
  notes.errorsOnlyUrl = p.url();
  await p.getByRole('searchbox', { name: '요청 경로 검색' }).or(p.getByLabel('요청 경로 검색')).first().fill('zzz-no-match');
  await p.getByRole('button', { name: '검색', exact: true }).click(); await p.waitForTimeout(700);
  await shot(p, 'filter-nomatch');
  // 제외 경로 설정 펼치기
  await go(p, 'api/observed_mock_orders');
  await p.getByText(/API 제외 경로/).first().click(); await p.waitForTimeout(300);
  await p.getByText(/API 제외 경로/).first().scrollIntoViewIfNeeded();
  await shot(p, 'exclusions', { full: false });
  // 트레이스 탭 행 키보드 열기
  await go(p, 'api/observed_mock_orders?tab=traces');
  await p.locator('main tbody tr[tabindex]').first().focus().catch(() => {});
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  notes.traceRowEnterOpensPanel = await p.getByRole('dialog', { name: '트레이스 상세' }).count();
  await c.close();
}

// 3. 추가 흐름: API 연결 → 결과 → 새 서비스 상세(수신 전)
{
  const c = await ctx(); const p = await c.newPage();
  await go(p, 'api');
  await p.getByRole('button', { name: /API 연결/ }).first().click(); await p.waitForTimeout(600);
  await shot(p, 'setup-1', { runAxe: true });
  await p.getByRole('dialog').locator('input').first().fill('checkout-api-without-data-very-long-name-for-truncation-check-01');
  await p.getByRole('dialog').getByRole('button', { name: /추가/ }).click(); await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelectorAll('dialog code').forEach(e => { e.textContent = e.textContent.replace(/evup_[A-Za-z0-9_-]{6,}/g, 'evup_[MASKED]'); }));
  await p.evaluate(() => document.querySelectorAll('dialog pre').forEach(e => { e.textContent = e.textContent.replace(/evup_[A-Za-z0-9_-]{6,}/g, 'evup_[MASKED]'); }));
  await shot(p, 'setup-result', { runAxe: true });
  notes.setupDialogScroll = await p.locator('dialog[open]').evaluate(e => [e.scrollHeight, e.clientHeight]);
  await p.locator('dialog[open]').getByRole('button', { name: /API 보기/ }).click(); await p.waitForTimeout(1200);
  notes.afterAddUrl = p.url();
  await shot(p, 'new-nodata-detail');
  await go(p, 'api');
  await shot(p, 'list-after-add');
  await c.close();
}

// 4. 시나리오: 빈 목록, 일부 실패
for (const sc of ['empty', 'partial-failure', 'normal']) {
  const c = await ctx(1440, 'light', sc); const p = await c.newPage();
  await go(p, 'api'); await shot(p, `scenario-${sc}-list`);
  await c.close();
}
await fs.writeFile(path.join(out, 'notes.json'), JSON.stringify(notes, null, 2));
await browser.close();
