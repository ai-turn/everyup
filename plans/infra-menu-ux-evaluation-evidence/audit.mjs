import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const tools = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules');
const { chromium } = await import(pathToFileURL(path.join(tools, 'playwright/index.mjs')));
const axePath = path.join(tools, 'axe-core/axe.min.js');
const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'cap');
await fs.mkdir(out, { recursive: true });
const demo = 'http://127.0.0.1:5207/everyup/demo/';
const browser = await chromium.launch({ headless: true });
const log = [];

async function ctx(width = 1440, theme = 'light', scenario = 'attention') {
  const c = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: theme, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
  await c.addInitScript(({ theme, scenario }) => { localStorage.setItem('theme', theme); sessionStorage.setItem('everyup_demo_scenario', scenario); }, { theme, scenario });
  c.setDefaultTimeout(7000);
  return c;
}
async function go(page, route) { await page.goto(demo + route); await page.waitForTimeout(900); }
async function shot(page, id, { axe = false, full = true } = {}) {
  await page.screenshot({ path: path.join(out, id + '.png'), fullPage: full });
  const info = await page.evaluate(() => {
    const main = document.querySelector('dialog[open]') ?? document.querySelector('main');
    const pos = sel => [...document.querySelectorAll(sel)].map(e => Math.round(e.getBoundingClientRect().top));
    return { text: main?.innerText, docW: document.documentElement.scrollWidth, vw: innerWidth,
      gaugeTop: pos('h3, h2').slice(0, 12), small: [...(main?.querySelectorAll('button,a,[role=button],select') ?? [])].map(e => { const r = e.getBoundingClientRect(); return { l: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter(x => x.h > 0 && x.h < 32) };
  });
  if (axe) {
    await page.addScriptTag({ path: axePath });
    info.axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ') + ' | ' + (n.any[0]?.message ?? '')) })));
  }
  await fs.writeFile(path.join(out, id + '.json'), JSON.stringify(info, null, 2));
  log.push(id);
}

for (const [w, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
  const tag = `${w}-${theme}`;
  const c = await ctx(w, theme); const p = await c.newPage();
  await go(p, 'infrastructure?view=card'); await shot(p, `${tag}-list-card`, { axe: true });
  await go(p, 'infrastructure?view=grid'); await shot(p, `${tag}-list-grid`);
  await go(p, 'infrastructure?view=card');
  await p.locator('main a[href*="/infrastructure/"]').first().click(); await p.waitForTimeout(900);
  log.push('detail-url ' + p.url());
  await shot(p, `${tag}-detail`, { axe: true });
  if (w === 390) await shot(p, `${tag}-detail-fold`, { full: false });
  await c.close();
}

// Ranges, tooltip, keyboard on charts (desktop light)
{
  const c = await ctx(); const p = await c.newPage();
  await go(p, 'infrastructure'); await p.locator('main a[href*="/infrastructure/"]').first().click(); await p.waitForTimeout(900);
  const detailUrl = p.url();
  for (const r of ['1h', '24h', '7d']) {
    const b = p.getByRole('button', { name: new RegExp(`^${r}$`, 'i') }).first();
    if (await b.count()) { await b.click(); await p.waitForTimeout(700); await shot(p, `range-${r}`); } else log.push('no range button ' + r);
  }
  const chart = p.locator('.recharts-wrapper').first();
  const box = await chart.boundingBox();
  if (box) { await p.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5); await p.waitForTimeout(300); await shot(p, 'tooltip', { full: false }); }
  // keyboard: tab through, record focus sequence
  await p.goto(detailUrl); await p.waitForTimeout(900);
  const seq = [];
  for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement; return `${e.tagName}:${(e.getAttribute('aria-label') || e.innerText || e.className?.toString?.() || '').trim().slice(0, 40)}`; })); }
  await fs.writeFile(path.join(out, 'tab-sequence.json'), JSON.stringify(seq, null, 2));
  // setup dialog from list
  await go(p, 'infrastructure');
  await p.getByRole('button', { name: /인프라 연결/ }).first().click(); await p.waitForTimeout(500);
  await shot(p, 'setup-1', { axe: true });
  const submit = p.locator('dialog[open], [role=dialog]').getByRole('button').filter({ hasText: /연결|만들기|발급|다음/ }).last();
  const nameInput = p.locator('[role=dialog] input, dialog[open] input').first();
  if (await nameInput.count()) await nameInput.fill('very-long-hostname-for-boundary-check-production-database-replica-02');
  if (await submit.count()) { await submit.click(); await p.waitForTimeout(800); await shot(p, 'setup-2', { axe: true }); }
  await c.close();
}

// States: empty, partial-failure, injected failures, missing values, long name
for (const sc of ['empty', 'partial-failure', 'normal']) {
  const c = await ctx(1440, 'light', sc); const p = await c.newPage();
  await go(p, 'infrastructure'); await shot(p, `scenario-${sc}-list`);
  await c.close();
}
log.push('done');
await fs.writeFile(path.join(out, 'log.json'), JSON.stringify(log, null, 2));
await browser.close();
