// Read-only deployed-page audit. Supply an installed Playwright module when needed:
// node capture.mjs --playwright=C:/path/to/node_modules/playwright/index.mjs --phase=matrix
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const { chromium } = await import(args.playwright ? pathToFileURL(args.playwright).href : 'playwright');
const root = path.dirname(fileURLToPath(import.meta.url));
await fs.mkdir(path.join(root, 'captures'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const home = 'https://ai-turn.github.io/everyup/';
const demo = `${home}demo/`;
const payment = `${demo}services/agent_demo_01/shop%3Apayment-worker?tab=uptime`;
const records = [];
const checks = [];
const errors = [];
const phase = args.phase || 'matrix';

async function context(width, height, theme = 'light') {
  return browser.newContext({ viewport: { width, height }, colorScheme: theme,
    locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: width < 600, hasTouch: width < 600,
    deviceScaleFactor: 1 });
}

async function ready(page) {
  await page.locator('h1').first().waitFor({ timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450); // Allow route rendering and chart transitions to settle.
}

async function visit(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(page);
}

async function capture(page, id, note = '') {
  await page.evaluate(() => document.fonts.ready);
  const metadata = await page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const rect = el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const active = document.activeElement;
    return {
      time: new Date().toISOString(), url: location.href, title: document.title,
      ua: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight },
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      scenario: sessionStorage.getItem('everyup_demo_scenario') || 'attention',
      storage: { local: { ...localStorage }, session: { ...sessionStorage } },
      touch: matchMedia('(pointer: coarse)').matches,
      documentWidth: document.documentElement.scrollWidth,
      text: document.body.innerText,
      active: active ? { tag: active.tagName, text: active.textContent?.trim(), label: active.getAttribute('aria-label'),
        outline: getComputedStyle(active).outline, rect: rect(active) } : null,
      controls: [...document.querySelectorAll('a,button,input,select,[role=combobox],[role=tab]')]
        .filter(visible).map(el => ({ tag: el.tagName, role: el.getAttribute('role'),
          name: el.getAttribute('aria-label') || el.textContent?.trim(), href: el.getAttribute('href'),
          target: el.getAttribute('target'), rect: rect(el) })),
      horizontalOverflow: [...document.querySelectorAll('main *,[data-demo-chrome] *')]
        .filter(el => visible(el) && el.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 12).map(el => ({ tag: el.tagName, class: typeof el.className === 'string' ? el.className : '',
          text: el.textContent?.trim().slice(0, 100), rect: rect(el) })),
      assets: [...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(el => el.src || el.href),
    };
  });
  const image = `captures/${id}.png`;
  await page.screenshot({ path: path.join(root, image), animations: 'disabled' });
  const record = { id, note, image, ...metadata };
  await fs.writeFile(path.join(root, `captures/${id}.json`), JSON.stringify(record, null, 2) + '\n');
  records.push({ id, note, image, url: record.url, viewport: record.viewport, theme: record.theme,
    scenario: record.scenario, time: record.time, documentWidth: record.documentWidth });
  console.log(JSON.stringify({ capture: id, url: record.url, theme: record.theme, scenario: record.scenario }));
  return record;
}

async function selectScenario(page, name) {
  await page.getByRole('combobox', { name: '데모 시나리오' }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
  await ready(page);
}

async function stage(id, run) {
  try { await run(); } catch (error) {
    errors.push({ id, error: String(error), stack: error.stack });
    console.log(JSON.stringify({ stage: id, error: String(error) }));
  }
}

try {
  if (phase === 'matrix') {
    for (const [size, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      for (const theme of ['light', 'dark']) {
        await stage(`${size}-${theme}`, async () => {
          const ctx = await context(width, height, theme);
          const page = await ctx.newPage();
          await visit(page, home);
          await capture(page, `${size}-${theme}-home`, 'Fresh context; OS color preference; no stored theme.');
          await visit(page, demo);
          await page.getByRole('heading', { name: '현재 확인 필요' }).waitFor();
          await capture(page, `${size}-${theme}-attention-overview`);
          await page.locator('#attention').getByRole('link', { name: /payment-worker/ }).click();
          await page.getByRole('heading', { level: 1, name: 'payment-worker' }).waitFor();
          await ready(page);
          await capture(page, `${size}-${theme}-payment-uptime`);
          await page.getByRole('button', { name: '에러 확인', exact: true }).click();
          await page.getByText('Payment gateway timeout after 5000ms', { exact: true }).first().waitFor();
          await capture(page, `${size}-${theme}-payment-logs`);
          await page.getByRole('button', { name: '트레이스', exact: true }).first().click();
          await page.getByRole('dialog', { name: '트레이스 상세' }).waitFor();
          await capture(page, `${size}-${theme}-payment-trace`);
          await page.keyboard.press('Escape');
          checks.push({ id: `${size}-${theme}-trace-escape`, closed: await page.getByRole('dialog').count() === 0 });
          await ctx.close();
        });
      }
      for (const [scenario, label] of [['normal', '정상 운영'], ['empty', '첫 시작'], ['partial-failure', '부분 수집 실패']]) {
        await stage(`${size}-${scenario}`, async () => {
          const ctx = await context(width, height);
          const page = await ctx.newPage();
          await visit(page, demo);
          await selectScenario(page, label);
          await capture(page, `${size}-light-${scenario}-overview`, 'Scenario changed through the visible selector.');
          if (scenario === 'empty') {
            await page.locator('section').filter({ hasText: '아직 모니터링 대상이 없습니다' })
              .getByRole('link', { name: 'Docker 연결', exact: true }).click();
            await ready(page);
            await capture(page, `${size}-light-empty-docker-connect`);
          }
          if (scenario === 'normal') {
            await visit(page, payment);
            await capture(page, `${size}-light-normal-payment`);
          }
          if (scenario === 'partial-failure') {
            const retry = page.getByRole('button', { name: /다시 시도/ }).first();
            if (await retry.count()) {
              await retry.click();
              await page.waitForTimeout(800);
              await capture(page, `${size}-light-partial-failure-retry`, 'No network fault injected; selected fixture still fails.');
            }
          }
          await ctx.close();
        });
      }
    }
  }

  if (phase === 'journey') {
    for (const [size, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      await stage(`${size}-journey`, async () => {
        const ctx = await context(width, height);
        const page = await ctx.newPage();
        await visit(page, home);
        const popup = page.waitForEvent('popup');
        await page.getByRole('link', { name: '라이브 데모', exact: true }).first().click();
        const app = await popup;
        await ready(app);
        checks.push({ id: `${size}-entry`, opensNewTab: true, url: app.url() });
        await capture(app, `${size}-journey-entry`);
        // Inspect the information architecture using visible navigation.
        if (size === 'mobile') {
          await app.getByRole('link', { name: '더보기', exact: true }).click();
          await ready(app);
          await capture(app, 'mobile-journey-more');
        }
        for (const [label, suffix] of [['로그', 'logs'], ['API 요청', 'api'], ['인프라', 'infrastructure']]) {
          if (size === 'mobile' && !app.url().endsWith('/more')) {
            await app.getByRole('link', { name: '더보기', exact: true }).click();
            await ready(app);
          }
          const nav = size === 'desktop' ? app.getByRole('navigation', { name: '주 메뉴' }) : app.locator('main');
          await nav.getByRole('link', { name: size === 'mobile' ? new RegExp(label) : label, exact: size === 'desktop' }).first().click();
          await ready(app);
          await capture(app, `${size}-journey-${suffix}`);
        }
        await visit(app, demo);
        await app.locator('#attention').getByRole('link', { name: /payment-worker/ }).click();
        await ready(app);
        await app.getByRole('tab', { name: 'API 요청', exact: true }).click();
        await app.waitForTimeout(700);
        await capture(app, `${size}-journey-payment-api`);
        checks.push({ id: `${size}-docs-exit`, links: await app.locator('a').evaluateAll(links =>
          links.filter(a => /guide|quickstart|文档|문서|시작|설치/.test(`${a.href} ${a.textContent}`)).map(a => ({ text: a.textContent, href: a.href }))) });
        // The introduction tab remains available because demo opened a popup.
        await page.getByRole('link', { name: '시작하기', exact: true }).click();
        await ready(page);
        await capture(page, `${size}-journey-quickstart`);
        await page.locator('h2').filter({ hasText: 'Web 실행' }).scrollIntoViewIfNeeded();
        await capture(page, `${size}-journey-quickstart-web`);
        await ctx.close();
      });
    }
  }

  if (phase === 'narrow') {
    const ctx = await context(320, 844);
    const page = await ctx.newPage();
    for (const [id, url] of [['home', home], ['overview', demo], ['payment', payment],
      ['quickstart', `${home}guide/quickstart`]]) {
      await stage(`narrow-${id}`, async () => {
        await visit(page, url);
        await capture(page, `narrow-light-${id}`);
      });
    }
    await ctx.close();
  }

  if (phase === 'aging') {
    const states = [];
    for (const scenario of ['attention', 'normal']) {
      const ctx = await context(1440, 900);
      const page = await ctx.newPage();
      await visit(page, demo);
      if (scenario === 'normal') await selectScenario(page, '정상 운영');
      await capture(page, `aging-${scenario}-start`, 'Wall-clock observation; no clock override.');
      states.push({ ctx, page, scenario });
    }
    // This process runs in the background while the audit continues.
    for (let i = 0; i < 2; i++) await states[0].page.waitForTimeout(55000);
    for (const { ctx, page, scenario } of states) {
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
      await page.waitForTimeout(600);
      await capture(page, `aging-${scenario}-after-110s`, 'Wall-clock elapsed; manually refreshed without reloading.');
      await ctx.close();
    }
  }

  if (phase === 'interaction') {
    const ctx = await context(1440, 900);
    const page = await ctx.newPage();
    const tabTo = async (p, target, limit = 100) => {
      for (let i = 0; i < limit; i++) {
        await p.keyboard.press('Tab');
        if (await target.evaluate(el => el === document.activeElement)) return i + 1;
      }
      throw new Error('Keyboard target not reached');
    };
    await stage('keyboard', async () => {
      await visit(page, home);
      const count = await tabTo(page, page.getByRole('link', { name: '라이브 데모', exact: true }).first());
      await capture(page, 'keyboard-home-demo');
      const popup = page.waitForEvent('popup');
      await page.keyboard.press('Enter');
      const app = await popup;
      await ready(app);
      await app.keyboard.press('Tab');
      checks.push({ id: 'keyboard-skip', focused: await app.getByRole('link', { name: '본문 바로가기' }).evaluate(el => el === document.activeElement), demoEntryTabs: count });
      await app.keyboard.press('Enter');
      const incident = app.locator('#attention').getByRole('link', { name: /payment-worker/ });
      checks.push({ id: 'keyboard-incident', tabsFromMain: await tabTo(app, incident) });
      await capture(app, 'keyboard-incident-focus');
      await app.keyboard.press('Enter');
      await ready(app);
      await tabTo(app, app.getByRole('button', { name: '에러 확인', exact: true }));
      await app.keyboard.press('Enter');
      await app.getByRole('button', { name: '트레이스', exact: true }).first().waitFor();
      const trace = app.getByRole('button', { name: '트레이스', exact: true }).first();
      await tabTo(app, trace);
      await capture(app, 'keyboard-trace-trigger');
      await app.keyboard.press('Enter');
      await app.waitForTimeout(400);
      const enterOpened = await app.getByRole('dialog', { name: '트레이스 상세' }).isVisible();
      checks.push({ id: 'keyboard-trace-enter', opened: enterOpened });
      await capture(app, 'keyboard-trace-after-enter');
      if (!enterOpened) {
        await app.keyboard.press('Space');
        await app.waitForTimeout(300);
        checks.push({ id: 'keyboard-trace-space', opened: await app.getByRole('dialog', { name: '트레이스 상세' }).isVisible() });
        await trace.click();
      }
      await app.getByRole('dialog', { name: '트레이스 상세' }).waitFor();
      await capture(app, 'keyboard-trace-open', enterOpened ? 'Opened with Enter.' : 'Pointer fallback after Enter and Space failed.');
      await app.waitForTimeout(300);
      await app.keyboard.press('Escape');
      await app.waitForTimeout(300);
      checks.push({ id: 'keyboard-trace-close', closed: await app.getByRole('dialog').count() === 0,
        focusRestored: await trace.evaluate(el => el === document.activeElement) });
      await capture(app, 'keyboard-trace-closed');
      if (await app.getByRole('dialog').count()) {
        await app.keyboard.press('Escape');
        await app.waitForTimeout(300);
        checks.push({ id: 'keyboard-trace-second-escape', closed: await app.getByRole('dialog').count() === 0 });
      }
      await app.close();
    });
    await ctx.close();

    await stage('demo-add', async () => {
      const ctx = await context(1440, 900);
      const page = await ctx.newPage();
      const requests = [];
      page.on('request', request => { if (request.method() !== 'GET') requests.push({ method: request.method(), url: request.url() }); });
      await visit(page, demo);
      await selectScenario(page, '첫 시작');
      await page.locator('section').filter({ hasText: '아직 모니터링 대상이 없습니다' })
        .getByRole('link', { name: 'Docker 연결', exact: true }).click();
      await ready(page);
      await page.getByRole('dialog').getByRole('textbox').fill('ux-audit-demo');
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(800);
      await capture(page, 'demo-docker-install-command', 'Simulated form only; no shell command executed.');
      checks.push({ id: 'demo-add-network', nonGetRequests: requests });
      await ctx.close();
    });

    for (const theme of ['light', 'dark']) {
      await stage(`contrast-${theme}`, async () => {
        const ctx = await context(390, 844, theme);
        const page = await ctx.newPage();
        await visit(page, demo);
        const styles = await page.locator('[data-demo-chrome]:visible').evaluate(el => {
          const badge = [...el.querySelectorAll('span')].find(span => span.textContent.trim() === 'Live Demo');
          const css = node => {
            const s = getComputedStyle(node);
            return { color: s.color, backgroundColor: s.backgroundColor, fontSize: s.fontSize, fontWeight: s.fontWeight };
          };
          // Convert modern CSS colors to sRGB with the browser's own color parser.
          const rgba = color => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const c = canvas.getContext('2d');
            c.fillStyle = color;
            c.fillRect(0, 0, 1, 1);
            return [...c.getImageData(0, 0, 1, 1).data];
          };
          const fg = rgba(getComputedStyle(badge).color);
          let bg = [255, 255, 255];
          const ancestors = [];
          for (let node = badge; node; node = node.parentElement) ancestors.unshift(node);
          for (const node of ancestors) {
            const v = rgba(getComputedStyle(node).backgroundColor);
            bg = bg.map((channel, i) => channel * (1 - v[3] / 255) + v[i] * v[3] / 255);
          }
          const lum = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
            .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          const l1 = lum(fg), l2 = lum(bg);
          return { badge: css(badge), banner: css(el), foregroundRgb: fg, effectiveBackgroundRgb: bg,
            ratio: (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) };
        });
        checks.push({ id: `mobile-demo-contrast-${theme}`, ...styles });
        await capture(page, `mobile-${theme}-demo-contrast`);
        await ctx.close();
      });
    }
  }

  if (phase === 'supplement') {
    for (const [size, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      await stage(`${size}-supplement`, async () => {
        const ctx = await context(width, height);
        const page = await ctx.newPage();
        await visit(page, payment);
        await page.locator('p').filter({ hasText: '평균' }).filter({ hasText: '최대' }).first().scrollIntoViewIfNeeded();
        await capture(page, `${size}-payment-response-summary`, 'Scrolled to the visible response chart summary.');
        await visit(page, `${demo}services/agent_demo_01/shop%3Apayment-worker?tab=logs`);
        const knownError = page.getByRole('button').filter({ has: page.getByText('Payment gateway timeout after 5000ms', { exact: true }) }).first();
        await knownError.getByRole('button', { name: '트레이스', exact: true }).click();
        await page.getByRole('dialog', { name: '트레이스 상세' }).waitFor();
        await page.waitForTimeout(400);
        await capture(page, `${size}-seed-error-trace`, 'The seeded timeout trace provides a successful alternative to the first generated error trace.');
        await visit(page, `${demo}infrastructure`);
        await page.getByRole('link', { name: 'edge-host-01', exact: true }).click();
        await ready(page);
        await capture(page, `${size}-infra-detail`);
        await visit(page, `${demo}api`);
        await page.getByRole('link', { name: 'payments-api', exact: true }).click();
        await ready(page);
        await capture(page, `${size}-direct-api-detail`);
        await ctx.close();
      });
    }
  }

  if (phase === 'accessibility') {
    for (const [size, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      await stage(`${size}-accessibility`, async () => {
        const ctx = await context(width, height);
        const page = await ctx.newPage();
        await visit(page, demo);
        const destination = size === 'desktop'
          ? page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '로그', exact: true })
          : page.getByRole('link', { name: '더보기', exact: true });
        let reached = false;
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          if (await destination.evaluate(el => el === document.activeElement)) { reached = true; break; }
        }
        checks.push({ id: `${size}-keyboard-menu-focus`, reached });
        await page.keyboard.press('Enter');
        await ready(page);
        await capture(page, `${size}-keyboard-menu`);
        await visit(page, demo);
        const selector = page.getByRole('combobox', { name: '데모 시나리오' });
        await selector.press('ArrowDown');
        await page.waitForTimeout(600);
        await ready(page);
        await capture(page, `${size}-keyboard-scenario`, 'ArrowDown selects normal and reloads the page.');
        await selectScenario(page, '확인 필요');
        await visit(page, payment);
        const plot = page.getByRole('group', { name: '체크별 결과와 응답 시간. 방향키로 체크를 옮깁니다' });
        await plot.scrollIntoViewIfNeeded();
        if (size === 'desktop') {
          await plot.focus();
          await page.keyboard.press('ArrowRight');
        } else {
          const box = await plot.boundingBox();
          await plot.tap({ position: { x: box.width - 12, y: box.height / 2 } });
        }
        await page.waitForTimeout(350);
        await capture(page, `${size}-response-plot-interaction`, size === 'desktop' ? 'Keyboard arrow on the focusable chart.' : 'Touch tap, no hover.');
        await ctx.close();
      });
    }
  }
} finally {
  await fs.writeFile(path.join(root, `${phase}.json`), JSON.stringify({
    phase, browserVersion: browser.version(), completedAt: new Date().toISOString(), records, checks, errors,
  }, null, 2) + '\n');
  await browser.close();
}
if (errors.length) process.exitCode = 1;
