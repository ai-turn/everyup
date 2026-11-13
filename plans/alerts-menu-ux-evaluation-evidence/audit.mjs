// 알림 메뉴 약식 점검 증거 수집. 메트릭 audit.mjs와 같은 방식(Playwright + axe, 의존성 추가 없음).
// 실행: node audit.mjs  (데모 개발 서버 http://127.0.0.1:5180/everyup/demo/ 를 재사용, 종료하지 않음)
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(out, '../../web/frontend');
const { chromium } = createRequire(path.join(frontend, 'package.json'))('@playwright/test');
const axePath = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules/axe-core/axe.min.js');
const demo = 'http://127.0.0.1:5180/everyup/demo/';
const browser = await chromium.launch({ headless: true });
const log = [];

async function ctx(width = 1440, theme = 'light', scenario = 'attention') {
  const c = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: theme, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
  await c.addInitScript(({ theme, scenario }) => { localStorage.setItem('theme', theme); sessionStorage.setItem('everyup_demo_scenario', scenario); }, { theme, scenario });
  c.setDefaultTimeout(7000);
  return c;
}
async function go(page, route) { await page.goto(demo + route); await page.waitForTimeout(1300); }
const MASK = /(eu_[A-Za-z0-9_-]{6,}|evup_[A-Za-z0-9_*-]{4,}|Bearer\s+\S+|[A-Za-z0-9]{32,})/g;
async function shot(page, id, { axe = false, full = true } = {}) {
  await page.screenshot({ path: path.join(out, id + '.png'), fullPage: full });
  const info = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role=dialog]')].pop();
    const main = dialog ?? document.querySelector('main');
    return {
      url: location.href, text: main?.innerText?.slice(0, 6000), docW: document.documentElement.scrollWidth, vw: innerWidth,
      toasts: [...document.querySelectorAll('[role=status], [role=alert]')].map(e => e.innerText.trim()).filter(Boolean).slice(0, 6),
      // 선택형 버튼 묶음이 선택 상태를 보조기술에 알리는지
      pressable: [...(main?.querySelectorAll('button') ?? [])].filter(b => /border-2/.test(b.className)).map(b => ({ t: b.innerText.trim().slice(0, 20), pressed: b.getAttribute('aria-pressed'), checked: b.getAttribute('aria-checked') })),
      invalid: [...document.querySelectorAll('[aria-invalid=true]')].map(e => e.id || e.name),
      small: [...(main?.querySelectorAll('button,a,[role=button],[role=switch],select,summary') ?? [])].map(e => { const r = e.getBoundingClientRect(); return { l: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter(x => x.h > 0 && x.h < 24),
    };
  });
  if (info.text) info.text = info.text.replace(MASK, '****MASKED****');
  if (axe) {
    await page.addScriptTag({ path: axePath });
    info.axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 5).map(n => n.target.join(' ') + ' | ' + (n.any[0]?.message ?? n.all[0]?.message ?? '')) })));
  }
  await fs.writeFile(path.join(out, id + '.json'), JSON.stringify(info, null, 2));
  log.push(id);
}
const tryClick = async (loc, label) => { if (await loc.count()) { await loc.first().click(); await loc.page().waitForTimeout(900); return true; } log.push('missing ' + label); return false; };
const closePanel = async p => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); };

for (const [w, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
  const tag = `${w}-${theme}`;
  const c = await ctx(w, theme); const p = await c.newPage();
  await go(p, 'alerts'); await shot(p, `${tag}-channels`, { axe: true });
  await go(p, 'alerts?tab=rules'); await shot(p, `${tag}-rules`, { axe: true });
  await go(p, 'alerts?tab=history'); await shot(p, `${tag}-history`, { axe: true });
  // 규칙 추가 패널
  await go(p, 'alerts?tab=rules');
  if (await tryClick(p.locator('main').getByRole('button', { name: '추가', exact: true }), 'rule add ' + tag)) {
    await shot(p, `${tag}-rule-add`, { axe: true });
    if (w === 1440 && theme === 'light') {
      await tryClick(p.locator('[role=dialog] button', { hasText: '메트릭' }), 'metric category');
      await shot(p, `${tag}-rule-add-metric`);
      // 빈 이름으로 제출: 인라인 오류가 생기는지
      await tryClick(p.locator('[role=dialog]').getByRole('button', { name: '추가', exact: true }), 'rule submit');
      await p.waitForTimeout(300);
      await shot(p, `${tag}-rule-add-submit-empty`, { full: false });
      await closePanel(p);
      // 다시 열어 '정상' 프리셋을 고른 뒤 미리보기
      await tryClick(p.locator('main').getByRole('button', { name: '추가', exact: true }), 'rule add 2');
      await tryClick(p.locator('[role=dialog] button', { hasText: '인프라' }), 'resource category');
      await tryClick(p.locator('[role=dialog] button', { hasText: /^정상$/ }), 'normal preset');
      await shot(p, `${tag}-rule-add-normal-preset`, { full: false });
    }
    await closePanel(p);
  }
  // 채널 추가: 데스크톱은 사이드 패널, 모바일은 전용 페이지
  if (w === 1440) {
    await go(p, 'alerts');
    if (await tryClick(p.locator('main').getByRole('button', { name: '추가', exact: true }), 'channel add')) { await shot(p, `${tag}-channel-add`, { axe: true }); await closePanel(p); }
  } else {
    await go(p, 'alerts/channels/new'); await shot(p, `${tag}-channel-page`, { axe: true });
  }
  await c.close();
}

// 데스크톱 라이트: 수정·시스템 규칙·대상 필터·채널 편집·테스트·실패 로그
{
  const c = await ctx(); const p = await c.newPage();
  await go(p, 'alerts?tab=rules');
  const rows = p.locator('table[aria-label="알림 규칙 그리드"] tbody tr');
  const rowText = await rows.allInnerTexts();
  await fs.writeFile(path.join(out, 'rules-rows.json'), JSON.stringify(rowText, null, 2));
  // 메트릭 규칙(Billing queue backlog) 수정
  const billing = rows.filter({ hasText: 'Billing queue backlog' });
  if (await tryClick(billing.getByRole('button', { name: '수정' }), 'edit billing')) { await p.waitForTimeout(600); await shot(p, 'rule-edit-metric'); await closePanel(p); }
  // 시스템 규칙: 삭제 버튼 상태와 수정 패널
  const sys = rows.filter({ has: p.locator('text=시스템 기본 규칙') });
  if (await sys.count()) {
    const del = sys.first().getByRole('button', { name: /삭제/ });
    const info = { label: await del.getAttribute('aria-label'), ariaDisabled: await del.getAttribute('aria-disabled') };
    await del.focus(); await p.waitForTimeout(500);
    info.tooltip = await p.locator('[role=tooltip]').allInnerTexts();
    await del.click({ force: true }); await p.waitForTimeout(400); // aria-disabled라 force
    info.dialogOpened = await p.locator('dialog[open]').count();
    await fs.writeFile(path.join(out, 'system-rule-delete.json'), JSON.stringify(info, null, 2));
    await tryClick(sys.getByRole('button', { name: '수정' }), 'edit system'); await p.waitForTimeout(600); await shot(p, 'rule-edit-system', { axe: true }); await closePanel(p);
  } else log.push('no system rule row');
  // 대상 필터: 메트릭 상세의 '알림 규칙' 버튼과 같은 URL, 업타임 모니터 URL
  await go(p, 'alerts?tab=rules&target=direct&serviceId=observed_mock_billing'); await shot(p, 'target-direct-billing');
  if (await tryClick(p.locator('main').getByRole('button', { name: '추가', exact: true }), 'add from target')) { await tryClick(p.locator('[role=dialog] button', { hasText: '메트릭' }), 'metric cat 2'); await shot(p, 'target-direct-add', { full: false }); await closePanel(p); }
  await go(p, 'alerts?tab=rules&target=direct&serviceId=uptime_mock_payments'); await shot(p, 'target-uptime');
  if (await tryClick(p.locator('main').getByRole('button', { name: '추가', exact: true }), 'add from uptime')) {
    // Select는 숨긴 네이티브 select + 보이는 트리거(id) 구조라 트리거 앞의 select에서 읽는다
    const opts = await p.evaluate(() => [...(document.getElementById('rule-target')?.previousElementSibling?.options ?? [])].map(o => o.text));
    await fs.writeFile(path.join(out, 'uptime-target-options.json'), JSON.stringify({ healthcheckTargetOptions: opts }, null, 2));
    await closePanel(p);
  }
  // 채널 편집(Telegram): 마스킹된 토큰이 입력값으로 들어오는지
  await go(p, 'alerts');
  const tg = p.locator('table[aria-label="알림 채널 그리드"] tbody tr').filter({ hasText: 'Ops Telegram' });
  if (await tryClick(tg.getByRole('button', { name: '수정' }), 'edit telegram')) {
    const vals = { botToken: await p.locator('#channel-bot-token').inputValue().catch(() => null), chatId: await p.locator('#channel-chat-id').inputValue().catch(() => null) };
    await fs.writeFile(path.join(out, 'channel-edit-telegram-values.json'), JSON.stringify(vals, null, 2));
    await shot(p, 'channel-edit-telegram'); await closePanel(p);
  }
  const dc = p.locator('table[aria-label="알림 채널 그리드"] tbody tr').filter({ hasText: '#alerts Discord' });
  if (await tryClick(dc.getByRole('button', { name: '수정' }), 'edit discord')) {
    await p.locator('#channel-name').fill('#alerts Discord 2');
    await tryClick(p.locator('[role=dialog]').getByRole('button', { name: '저장', exact: true }), 'save discord');
    await shot(p, 'channel-edit-discord-save', { full: false }); await closePanel(p);
  }
  // 저장된 채널 테스트: 결과가 어디에 남는지
  await go(p, 'alerts');
  await tryClick(p.locator('table[aria-label="알림 채널 그리드"] tbody tr').first().getByRole('button', { name: '테스트' }), 'test channel');
  await p.waitForTimeout(300); await shot(p, 'channel-test-toast', { full: false });
  // 실패 로그 보기
  await go(p, 'alerts');
  if (await tryClick(p.getByRole('button', { name: /실패 로그 보기/ }), 'failed logs')) await shot(p, 'history-failed');
  // 발송 이력 유형 필터 선택지
  await go(p, 'alerts?tab=history');
  const typeOpts = await p.evaluate(() => [...(document.querySelector('button[aria-label="전체 타입"]')?.previousElementSibling?.options ?? [])].map(o => o.text));
  await fs.writeFile(path.join(out, 'history-type-options.json'), JSON.stringify(typeOpts, null, 2));
  // 카드 보기
  await go(p, 'alerts?tab=rules&view=card'); await shot(p, '1440-light-rules-card');
  await go(p, 'alerts?tab=history&view=card'); await shot(p, '1440-light-history-card');
  // 탭 정지점(규칙 표)
  await go(p, 'alerts?tab=rules');
  const seq = [];
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement; return `${e.tagName}${e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : ''}:${(e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 40)}`; })); }
  await fs.writeFile(path.join(out, 'tab-sequence-rules.json'), JSON.stringify(seq, null, 2));
  await c.close();
}

// 모바일: 규칙 카드에 보이는 정보, 채널 편집 페이지
{
  const c = await ctx(390); const p = await c.newPage();
  await go(p, 'alerts?tab=rules&view=card'); await shot(p, '390-light-rules-card');
  await go(p, 'alerts?tab=history&view=card'); await shot(p, '390-light-history-card');
  await go(p, 'alerts/channels/1/edit'); await shot(p, '390-light-channel-edit');
  await go(p, 'alerts?tab=rules&target=direct&serviceId=observed_mock_billing'); await shot(p, '390-light-target');
  await c.close();
}

// 시나리오: 빈 상태, 조회 일부 실패
for (const sc of ['empty', 'partial-failure']) {
  const c = await ctx(1440, 'light', sc); const p = await c.newPage();
  for (const tab of ['channels', 'rules', 'history']) { await go(p, `alerts?tab=${tab}`); await shot(p, `scenario-${sc}-${tab}`); }
  await c.close();
}
{
  const c = await ctx(390, 'light', 'partial-failure'); const p = await c.newPage();
  await go(p, 'alerts?tab=rules'); await shot(p, 'scenario-partial-failure-390-rules');
  await c.close();
}
log.push('done');
await fs.writeFile(path.join(out, 'log.json'), JSON.stringify(log, null, 2));
await browser.close();
