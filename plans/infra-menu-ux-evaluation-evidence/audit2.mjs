import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const tools = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules');
const { chromium } = await import(pathToFileURL(path.join(tools, 'playwright/index.mjs')));
const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'cap');
const demo = 'http://127.0.0.1:5207/everyup/demo/';
const browser = await chromium.launch({ headless: true });
const notes = {};
async function ctx(width = 1440, theme = 'light') {
  const c = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: theme, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
  await c.addInitScript(t => { localStorage.setItem('theme', t); sessionStorage.setItem('everyup_demo_scenario', 'attention'); }, theme);
  c.setDefaultTimeout(7000); return c;
}
const scrollTo = (p, y) => p.locator('main > div.overflow-y-auto').evaluate((e, y) => { e.scrollTop = y; }, y);
const shot = (p, id) => p.screenshot({ path: path.join(out, id + '.png') });

{ // desktop detail lower half, db-primary (near threshold)
  const c = await ctx(); const p = await c.newPage();
  await p.goto(demo + 'infrastructure/infra_mock_edge_01'); await p.waitForTimeout(900);
  await scrollTo(p, 560); await p.waitForTimeout(200); await shot(p, 'd-edge-lower');
  await scrollTo(p, 99999); await p.waitForTimeout(200); await shot(p, 'd-edge-bottom');
  await p.goto(demo + 'infrastructure/infra_mock_db_01'); await p.waitForTimeout(900); await shot(p, 'd-db-top');
  notes.dbText = (await p.locator('main').innerText()).slice(0, 1500);
  // keyboard on a trend chart
  await scrollTo(p, 560);
  const svg = p.locator('.recharts-wrapper svg').nth(4);
  await svg.focus().catch(() => {});
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(200); await shot(p, 'd-keyboard');
  notes.focused = await p.evaluate(() => { const e = document.activeElement; return e.tagName + ' ' + (e.getAttribute('aria-label') ?? '') + ' role=' + e.getAttribute('role'); });
  await c.close();
}
{ // create a new host via dialog, then open its detail (key issued, no data)
  const c = await ctx(); const p = await c.newPage();
  await p.goto(demo + 'infrastructure'); await p.waitForTimeout(900);
  await p.getByRole('button', { name: /인프라 연결/ }).first().click(); await p.waitForTimeout(400);
  await p.getByRole('dialog').locator('input').first().fill('new-host-without-data-very-long-name-for-truncation-check-01');
  await p.getByRole('dialog').getByRole('button', { name: /추가/ }).click(); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(out, 'setup-result.png'), fullPage: true });
  notes.setupText = (await p.getByRole('dialog').innerText()).replace(/evup_[A-Za-z0-9_-]+/g, 'evup_[MASKED]');
  const dlgH = await p.getByRole('dialog').evaluate(e => [e.scrollHeight, e.clientHeight]);
  notes.dialogScroll = dlgH;
  await p.getByRole('dialog').getByRole('button', { name: /완료|닫기|확인/ }).last().click(); await p.waitForTimeout(600);
  await shot(p, 'list-after-add');
  await p.getByRole('link', { name: /new-host-without-data/ }).first().click(); await p.waitForTimeout(900);
  await shot(p, 'd-nodata');
  notes.nodataText = (await p.locator('main').innerText()).slice(0, 1200);
  await c.close();
}
{ // mobile detail full scroll positions
  const c = await ctx(390); const p = await c.newPage();
  await p.goto(demo + 'infrastructure/infra_mock_edge_01'); await p.waitForTimeout(900);
  notes.mobilePos = await p.evaluate(() => [...document.querySelectorAll('main h2, main article, main .recharts-wrapper')].slice(0, 8).map(e => e.tagName + ':' + (e.innerText ?? '').slice(0, 12).replace(/\n/g, ' ') + '@' + Math.round(e.getBoundingClientRect().top)));
  await scrollTo(p, 700); await p.waitForTimeout(200); await shot(p, 'm-mid');
  await c.close();
}
await fs.writeFile(path.join(out, 'notes2.json'), JSON.stringify(notes, null, 2));
await browser.close();
