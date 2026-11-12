// 메트릭 메뉴 약식 점검 증거 수집. 인프라 audit.mjs와 같은 방식(Playwright + axe, 의존성 추가 없음).
// 실행: node audit.mjs  (데모: pnpm exec vite build --mode demo --outDir <dir> 후 vite preview --port 5212)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const tools = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules');
const { chromium } = await import(pathToFileURL(path.join(tools, 'playwright/index.mjs')));
const axePath = path.join(tools, 'axe-core/axe.min.js');
const out = path.dirname(fileURLToPath(import.meta.url));
const demo = 'http://127.0.0.1:5212/everyup/demo/';
const browser = await chromium.launch({ headless: true });
const log = [];

async function ctx(width = 1440, theme = 'light', scenario = 'attention') {
  const c = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: theme, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
  await c.addInitScript(({ theme, scenario }) => { localStorage.setItem('theme', theme); sessionStorage.setItem('everyup_demo_scenario', scenario); }, { theme, scenario });
  c.setDefaultTimeout(7000);
  return c;
}
async function go(page, route) { await page.goto(demo + route); await page.waitForTimeout(1200); }
// API Key 등은 화면·텍스트 기록 모두에서 가린다
const MASK = /(eu_[A-Za-z0-9_-]{6,}|Bearer\s+\S+|[A-Za-z0-9]{32,})/g;
async function shot(page, id, { axe = false, full = true } = {}) {
  await page.evaluate(() => { for (const el of document.querySelectorAll('code, pre')) el.textContent = el.textContent.replace(/(eu_[A-Za-z0-9_-]{6,}|Bearer\s+\S+|[A-Za-z0-9]{32,})/g, '****MASKED****'); });
  await page.screenshot({ path: path.join(out, id + '.png'), fullPage: full });
  const info = await page.evaluate(() => {
    const main = document.querySelector('[role=dialog]') ?? document.querySelector('main');
    const pos = sel => [...document.querySelectorAll(sel)].map(e => [e.innerText.trim().slice(0, 30), Math.round(e.getBoundingClientRect().top)]);
    return { url: location.href, text: main?.innerText, docW: document.documentElement.scrollWidth, vw: innerWidth,
      headings: pos('main h1, main h2, main h3').slice(0, 20), firstChartTop: Math.round(document.querySelector('.recharts-wrapper')?.getBoundingClientRect().top ?? -1),
      small: [...(main?.querySelectorAll('button,a,[role=button],select,summary') ?? [])].map(e => { const r = e.getBoundingClientRect(); return { l: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter(x => x.h > 0 && x.h < 24) };
  });
  if (info.text) info.text = info.text.replace(MASK, '****MASKED****');
  if (axe) {
    await page.addScriptTag({ path: axePath });
    info.axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ') + ' | ' + (n.any[0]?.message ?? '')) })));
  }
  await fs.writeFile(path.join(out, id + '.json'), JSON.stringify(info, null, 2));
  log.push(id);
}
const firstDetail = p => p.locator('main a[href*="/metrics/"]').first();

for (const [w, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
  const tag = `${w}-${theme}`;
  const c = await ctx(w, theme); const p = await c.newPage();
  await go(p, 'metrics'); await shot(p, `${tag}-list-grid`, { axe: true });
  await go(p, 'metrics?view=card'); await shot(p, `${tag}-list-card`);
  await go(p, 'metrics'); await firstDetail(p).click(); await p.waitForTimeout(1500);
  log.push(`detail-url ${tag} ${p.url()}`);
  await shot(p, `${tag}-detail`, { axe: true });
  if (w === 390) await shot(p, `${tag}-detail-fold`, { full: false });
  // 단독 보기: 첫 패널 제목 버튼(aria-label = 원본 메트릭 이름)
  const titleBtn = p.locator('main section[aria-label] button[aria-label]:not([aria-pressed])').first();
  if (await titleBtn.count()) { await titleBtn.click(); await p.waitForTimeout(1500); await shot(p, `${tag}-expanded`, { axe: true }); }
  else log.push('no panel title ' + tag);
  await c.close();
}

// 단독 보기 탐색 조건, 툴팁, 키보드 (데스크톱 라이트)
{
  const c = await ctx(); const p = await c.newPage();
  await go(p, 'metrics'); await firstDetail(p).click(); await p.waitForTimeout(1500);
  const detailUrl = p.url();
  const chart = p.locator('.recharts-wrapper').first();
  const box = await chart.boundingBox();
  if (box) { await p.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5); await p.waitForTimeout(400); await shot(p, 'grid-tooltip', { full: false }); }
  // Tab 순서
  await p.goto(detailUrl); await p.waitForTimeout(1500);
  const seq = [];
  for (let i = 0; i < 45; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement; return `${e.tagName}${e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : ''}:${(e.getAttribute('aria-label') || e.innerText || e.className?.toString?.() || '').trim().slice(0, 40)}`; })); }
  await fs.writeFile(path.join(out, 'tab-sequence.json'), JSON.stringify(seq, null, 2));
  // 차트 SVG 포커스 후 화살표
  const svg = p.locator('.recharts-wrapper [tabindex="0"]').first();
  if (await svg.count()) {
    await svg.focus(); for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowLeft');
    await p.waitForTimeout(300);
    const kb = await p.evaluate(() => ({ focused: document.activeElement?.tagName + ':' + document.activeElement?.getAttribute('role'), tooltipVisible: [...document.querySelectorAll('.recharts-tooltip-wrapper')].some(e => getComputedStyle(e).visibility !== 'hidden' && e.innerText.trim()), cursor: document.querySelectorAll('.recharts-tooltip-cursor').length, live: [...document.querySelectorAll('main [aria-live]')].map(e => e.innerText.slice(0, 60)) }));
    await fs.writeFile(path.join(out, 'chart-keyboard.json'), JSON.stringify(kb, null, 2));
    await shot(p, 'chart-keyboard', { full: false });
  } else log.push('no focusable chart svg');
  // 히스토그램 단독 보기 + 탐색 조건 펼침
  const hist = p.locator('main section[aria-label] button[aria-label*="duration"]').first();
  if (await hist.count()) {
    await hist.click(); await p.waitForTimeout(1800);
    for (const s of await p.locator('main details:not([open]) > summary').all()) { await s.click().catch(() => {}); }
    await p.waitForTimeout(500);
    await shot(p, 'expanded-histogram-explorer', { axe: true });
  } else log.push('no histogram panel');
  // 다중 시리즈 sum (billing.jobs.completed)
  await go(p, 'metrics?q=billing');
  if (await firstDetail(p).count()) {
    await firstDetail(p).click(); await p.waitForTimeout(1500); await shot(p, 'detail-billing');
    const b = p.locator('main section[aria-label] button[aria-label="billing.jobs.completed"]').first();
    if (await b.count()) { await b.click(); await p.waitForTimeout(1800); for (const s of await p.locator('main details:not([open]) > summary').all()) await s.click().catch(() => {}); await p.waitForTimeout(500); await shot(p, 'expanded-multiseries', { axe: true }); }
    else log.push('no billing panel');
  }
  // 기간
  await p.goto(detailUrl); await p.waitForTimeout(1200);
  for (const r of ['1h', '24h']) {
    const b = p.getByRole('button', { name: new RegExp(`^${r}$`, 'i') }).first();
    if (await b.count()) { await b.click(); await p.waitForTimeout(900); await shot(p, `range-${r}`, { full: false }); } else log.push('no range button ' + r);
  }
  // 연결(추가) 흐름
  await go(p, 'metrics');
  await p.getByRole('button', { name: /메트릭 연결/ }).first().click(); await p.waitForTimeout(700);
  await shot(p, 'setup-1', { axe: true });
  const dialog = p.locator('[role=dialog]').last();
  const inputs = dialog.locator('input:not([type=hidden]):not([type=radio]):not([type=checkbox])');
  if (await inputs.count()) await inputs.first().fill('checkout-api-very-long-service-name-for-boundary-check-02');
  await shot(p, 'setup-1b');
  const submit = dialog.getByRole('button').filter({ hasText: /연결|추가|발급|다음/ }).last();
  if (await submit.count()) { await submit.click(); await p.waitForTimeout(1200); await shot(p, 'setup-2', { axe: true }); }
  await c.close();
}

for (const sc of ['empty', 'partial-failure', 'normal']) {
  const c = await ctx(1440, 'light', sc); const p = await c.newPage();
  await go(p, 'metrics'); await shot(p, `scenario-${sc}-list`);
  await c.close();
}
log.push('done');
await fs.writeFile(path.join(out, 'log.json'), JSON.stringify(log, null, 2));
await browser.close();
