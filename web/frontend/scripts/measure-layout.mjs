// 화면 배치 측정기. 간격을 고치는 PR이 "화면 변화 없음"을 숫자로 보이게 한다(DESIGN.md §3.7, §10.I).
//
//   pnpm measure [-- --out layout.json] [--only overview,servers] [--viewports 1440,390] [--shots dir]
//   node scripts/measure-layout.mjs --compare before.json after.json
//
// 데모 빌드를 미리보기로 띄우고(`pnpm measure`가 먼저 build:demo를 돌린다), 화면마다 글자 줄의 위치·간격·글자 조합,
// 카드·차트 머리·폼 필드·키-값 행·탭 → 패널 간격을 JSON으로 남긴다. 같은 기계에서 전후로 재고 --compare로 비교한다.
// 시계는 고정하고 Math.random은 시드로 고정해 두 번 재면 같은 값이 나온다(차트 눈금·시각 글자가 흔들리지 않게).
// 글자의 숫자는 비교에서 #으로 바꾼다. 위치·크기만 같으면 같은 화면이다.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };

if (args[0] === '--compare') {
  process.exit(compare(args[1], args[2]) ? 0 : 1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(flag('port', 4320)); // playwright(4173/4174)·screenshot(4319)과 겹치지 않게
const BASE = `http://127.0.0.1:${PORT}/everyup/demo`;
const OUT = flag('out', 'layout.json');
const ONLY = flag('only', '');
const VIEWPORTS = flag('viewports', '1440,390').split(',').map(Number);
const SHOTS = flag('shots', '');
const NOW = new Date('2026-11-21T06:00:00Z');

const E = 'server_mock_edge_host_01';
const click = (name, role = 'button') => async (page) => { await page.getByRole(role, { name, exact: true }).first().click(); await page.waitForTimeout(500); };
// [이름, 주소, 데모 시나리오, 측정 전 조작]. 2026-11-20~21 화면 점검(#133~#141)에서 잰 화면들이다.
const SCREENS = [
  ['overview', '/'],
  ['servers', '/servers'],
  ['server-overview', `/servers/${E}`],
  ['server-uptime-list', '/servers/server_mock_payments_api/uptime'],
  ['server-uptime-edge', `/servers/${E}/uptime`],
  ['server-uptime-detail', `/servers/${E}/uptime/uptime_mock_checkout`],
  ['server-infra', `/servers/${E}/infrastructure`],
  ['server-logs', `/servers/${E}/logs`],
  ['server-logs-app', `/servers/${E}/logs/observed_mock_checkout`],
  ['server-api', `/servers/${E}/api`],
  ['server-metrics', `/servers/${E}/metrics`],
  ['server-empty', '/servers/server_mock_staging_empty'],
  ['server-empty-api', '/servers/server_mock_staging_empty/api'],
  ['server-new', '/servers/new'],
  ['server-settings-dialog', `/servers/${E}`, null, click('서버 설정')],
  ['uptime-add-dialog', `/servers/${E}/uptime`, null, click('모니터 추가')],
  ['environments', '/environments'],
  ['env-connect-dialog', '/environments', null, click('Docker 연결')],
  ['env-overview', '/agents/agent_demo_01'],
  ['env-infra', '/agents/agent_demo_01/infrastructure'],
  ['env-logs', '/agents/agent_demo_01/logs'],
  ['env-api', '/agents/agent_demo_01/api'],
  ['svc-uptime', '/services/agent_demo_01/shop%3Aapi'],
  ['svc-logs', '/services/agent_demo_01/shop%3Aapi?tab=logs'],
  ['svc-requests', '/services/agent_demo_01/shop%3Aapi?tab=requests'],
  ['svc-traces', '/services/agent_demo_01/shop%3Apayment-worker?tab=traces'],
  ['svc-trace-panel', '/services/agent_demo_01/shop%3Apayment-worker?tab=traces', null, async (page) => { await page.locator('table[aria-label="트레이스 목록"] tbody tr').first().click(); await page.waitForTimeout(700); }],
  ['svc-metrics', '/services/agent_demo_01/shop%3Aapi?tab=metrics'],
  ['svc-infra', '/services/agent_demo_01/shop%3Aapi?tab=infra'],
  ['projects', '/projects'],
  ['project-dialog', '/projects', null, click('추가')],
  ['project-detail', '/projects/project_mock_production'],
  ['project-add-targets', '/projects/project_mock_production', null, click('대상 추가')],
  ['alerts-rules', '/alerts?tab=rules'],
  ['alerts-history', '/alerts?tab=history'],
  ['alerts-channels', '/alerts?tab=channels'],
  ['alert-rule-drawer', '/alerts?tab=rules', null, click('규칙 추가')],
  ['channel-new', '/alerts/channels/new'],
  ['settings', '/settings'],
  ['logs', '/logs'],
  ['empty-overview', '/', 'empty'],
  ['empty-servers', '/servers', 'empty'],
  ['fail-overview', '/', 'partial-failure'],
  ['more', '/more'],
  ['404', '/nope'],
];

// 브라우저 안에서 돈다. 본문(대화 상자가 열려 있으면 대화 상자)만 잰다.
function collect() {
  const vis = (el) => { if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 2 && r.height > 2 && !el.closest('.sr-only'); };
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; };
  const desc = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  const textBox = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() && vis(n.parentElement) ? 1 : 3) });
    let top = Infinity, bottom = -Infinity, n;
    while ((n = w.nextNode())) { const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) { if (r.width < 1) continue; top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); } }
    return top === Infinity ? null : { top: Math.round(top), bottom: Math.round(bottom) };
  };
  const out = { vw: innerWidth };
  const dialog = [...document.querySelectorAll('dialog[open], [role=dialog]')].filter(vis).pop();
  const root = dialog || document.querySelector('#main-content');
  out.root = dialog ? 'dialog' : 'main';
  // 글자 줄: [위, 앞 줄과의 간격, 역할, 크기/행간/굵기, 왼쪽, 글자]
  const boxes = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 3) });
  let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement; if (!vis(el) || el.closest('[data-demo-chrome]')) continue;
    const s = getComputedStyle(el); const rg = document.createRange(); rg.selectNodeContents(n);
    const role = el.closest('h1,h2,h3,h4')?.tagName.toLowerCase() ?? (el.closest('label') ? 'label' : el.closest('th') ? 'th' : el.closest('td') ? 'td' : el.closest('dt') ? 'dt' : el.closest('dd') ? 'dd' : el.closest('button,[role=tab]') ? 'btn' : el.closest('a') ? 'a' : el.closest('svg') ? 'svg' : el.tagName.toLowerCase());
    for (const r of rg.getClientRects()) { if (r.width < 1) continue; boxes.push({ x: Math.round(r.left), top: Math.round(r.top), bottom: Math.round(r.bottom), fs: parseFloat(s.fontSize), lh: s.lineHeight === 'normal' ? 0 : parseFloat(s.lineHeight), fw: s.fontWeight, text: n.textContent.trim().slice(0, 22), role }); }
  }
  boxes.sort((a, b) => a.top - b.top || a.x - b.x);
  const lines = [];
  for (const b of boxes) { const l = lines.find((x) => b.top < x.bottom - 2 && b.bottom > x.top + 2); if (l) { l.items.push(b); l.top = Math.min(l.top, b.top); l.bottom = Math.max(l.bottom, b.bottom); } else lines.push({ top: b.top, bottom: b.bottom, items: [b] }); }
  lines.sort((a, b) => a.top - b.top);
  out.lines = lines.map((l, i) => { const lead = l.items.slice().sort((a, b) => b.fs - a.fs || a.x - b.x)[0]; return [l.top, i ? l.top - lines[i - 1].bottom : null, lead.role, `${lead.fs}/${lead.lh}/${lead.fw}`, Math.min(...l.items.map((x) => x.x)), l.items.map((x) => x.text).join('|').slice(0, 60)]; });
  out.tabs = [...root.querySelectorAll('[role=tablist]')].filter(vis).map((t) => { const tabs = [...t.querySelectorAll('[role=tab]')].filter(vis); const bottom = Math.max(...tabs.map((x) => x.getBoundingClientRect().bottom)); const panel = [...root.querySelectorAll('[role=tabpanel]')].find(vis); const tb = panel && textBox(panel); return { label: t.getAttribute('aria-label'), toPanel: panel ? Math.round(panel.getBoundingClientRect().top - bottom) : null, toPanelText: tb ? tb.top - Math.round(bottom) : null }; });
  const cards = [...root.querySelectorAll('div,section,article,a,li,form')].filter(vis).filter((el) => { const s = getComputedStyle(el); return parseFloat(s.borderTopLeftRadius) >= 10 && s.borderTopWidth !== '0px' && el.getBoundingClientRect().width > 160 && el.getBoundingClientRect().height > 40; });
  out.cards = cards.slice(0, 20).map((el) => { const s = getComputedStyle(el); const tb = textBox(el); const r = R(el); return { t: desc(el), x: r.x, y: r.y, w: r.w, h: r.h, pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat).join('/'), textInset: tb ? `${tb.top - r.y}/${r.b - tb.bottom}` : null }; });
  out.fields = [...root.querySelectorAll('label')].filter(vis).slice(0, 20).map((l) => { const ctrl = l.htmlFor ? document.getElementById(l.htmlFor) : l.querySelector('input,select,textarea,button'); if (!ctrl || !vis(ctrl)) return null; const lt = textBox(l); const cr = R(ctrl); return { l: desc(l).slice(0, 14), labelToCtrl: lt ? cr.y - lt.bottom : null, ctrlH: cr.h }; }).filter(Boolean);
  out.charts = [...root.querySelectorAll('svg.recharts-surface')].filter(vis).slice(0, 8).map((svg) => { const card = svg.closest('section'); if (!card) return null; const cr = R(card); const head = card.querySelector('h2,h3,h4'); const ht = head && textBox(head); const sr = R(svg); return { card: desc(card).slice(0, 16), titleTop: ht ? ht.top - cr.y : null, titleToSvg: ht ? sr.y - ht.bottom : null, svgH: sr.h }; }).filter(Boolean);
  out.kv = [...root.querySelectorAll('dl')].filter(vis).slice(0, 6).map((dl) => [...new Set([...dl.querySelectorAll('dt')].filter(vis).map((d) => Math.round(d.getBoundingClientRect().top)))].sort((a, b) => a - b));
  return out;
}

// 시드가 있는 Math.random(mulberry32). 목업의 인프라 시계열이 매번 달라 차트 눈금 폭이 흔들리지 않게 한다.
function seedRandom() {
  let a = 0x2f6b1d3;
  Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function measure() {
  const server = spawn('pnpm', ['exec', 'vite', 'preview', '--mode', 'demo', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: path.resolve(here, '..'), stdio: 'ignore', shell: true });
  const browser = await chromium.launch();
  try {
    for (let i = 0; ; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch { /* 아직 뜨는 중 */ } if (i > 60) throw new Error('미리보기 서버가 뜨지 않았습니다'); await new Promise((r) => setTimeout(r, 500)); }
    const only = ONLY ? new Set(ONLY.split(',')) : null;
    const jobs = VIEWPORTS.flatMap((vw) => SCREENS.filter(([name]) => !only || only.has(name)).map((screen) => [vw, ...screen]));
    const result = {};
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });
    const worker = async () => {
      for (let job = jobs.shift(); job; job = jobs.shift()) {
        const [vw, name, url, scenario, action] = job;
        const vh = vw <= 480 ? 844 : 900;
        const context = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: vw <= 480, hasTouch: vw <= 480, reducedMotion: 'reduce' });
        await context.clock.setFixedTime(NOW);
        await context.addInitScript(seedRandom);
        await context.addInitScript((s) => { localStorage.setItem('theme', 'light'); sessionStorage.setItem('everyup_demo_scenario', s); }, scenario || 'attention');
        const page = await context.newPage();
        const key = `${vw}-${name}`;
        try {
          await page.goto(BASE + url, { waitUntil: 'networkidle' });
          await page.addStyleTag({ content: '[data-demo-chrome]{display:none!important} *{transition:none!important;animation:none!important}' });
          await page.evaluate(() => document.fonts.ready);
          await page.getByText('불러오는 중', { exact: true }).first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
          if (action) await action(page);
          await page.waitForTimeout(300);
          result[key] = await page.evaluate(collect);
          if (SHOTS) {
            // 본문은 스크롤 영역 안에 있어 전체 페이지 캡처가 창 높이에서 잘린다. 키가 큰 창(3200px)에서 다시 열어 한 장에 담는다
            // (측정이 끝난 뒤라 값에는 영향이 없다). 대화 상자는 측정한 창 그대로 찍는다.
            if (result[key].root === 'main') {
              await page.setViewportSize({ width: vw, height: 3200 });
              await page.reload({ waitUntil: 'networkidle' });
              await page.addStyleTag({ content: '[data-demo-chrome]{display:none!important} *{transition:none!important;animation:none!important}' });
              await page.waitForTimeout(1500);
            }
            await page.screenshot({ path: path.join(SHOTS, `${key}.png`) });
          }
        } catch (error) {
          result[key] = { error: String(error).slice(0, 200) };
        }
        await context.close();
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    const sorted = Object.fromEntries(Object.keys(result).sort().map((k) => [k, result[k]]));
    writeFileSync(OUT, JSON.stringify(sorted, null, 1));
    const errors = Object.entries(sorted).filter(([, v]) => v.error);
    console.log(`${Object.keys(sorted).length}개 화면을 ${OUT}에 저장했습니다${errors.length ? `, 실패 ${errors.length}개: ${errors.map(([k]) => k).join(', ')}` : ''}.`);
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

// 두 측정을 화면·항목별로 비교한다. 글자의 숫자는 #으로 바꿔 비교한다(시각·개수는 위치가 같으면 같은 화면이다).
function compare(beforePath, afterPath) {
  const before = JSON.parse(readFileSync(beforePath, 'utf8'));
  const after = JSON.parse(readFileSync(afterPath, 'utf8'));
  const text = (s) => (typeof s === 'string' ? s.replace(/\d/g, '#') : s);
  const deep = (a, b, at, diffs) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) diffs.push(`${at}: 길이 ${a.length} → ${b.length}`);
      for (let i = 0; i < Math.min(a.length, b.length); i++) deep(a[i], b[i], `${at}[${i}]`, diffs);
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) deep(a[k], b[k], `${at}.${k}`, diffs);
    } else if (text(a) !== text(b)) {
      diffs.push(`${at}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
  };
  let changed = 0;
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const diffs = [];
    deep(before[key], after[key], key, diffs);
    if (diffs.length) { changed++; console.log(`✗ ${key} (${diffs.length})`); diffs.slice(0, 12).forEach((d) => console.log(`    ${d}`)); }
  }
  console.log(changed ? `\n${changed}개 화면이 달라졌습니다.` : `차이 없음 (${Object.keys(after).length}개 화면).`);
  return changed === 0;
}

if (args[0] !== '--compare') await measure();
