import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../web/frontend/node_modules/@playwright/test/index.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5187/everyup/demo/';
const browser = await chromium.launch({
  executablePath: 'C:/Users/tmddn/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
});
const observations = { themes: [], keyboard: null, installation: null, pageErrors: [] };
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true });

async function contrast(locator, border = false) {
  return locator.evaluate((element, border) => {
    const rgba = color => {
      const context = document.createElement('canvas').getContext('2d');
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const nodes = [];
    for (let node = element; node; node = node.parentElement) nodes.unshift(node);
    let background = [255, 255, 255];
    for (const node of nodes) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      background = background.map((value, i) => value * (1 - color[3] / 255) + color[i] * color[3] / 255);
    }
    const style = getComputedStyle(element);
    const foreground = rgba(border ? style.borderTopColor : style.color);
    const luminance = rgb => rgb.slice(0, 3).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const a = luminance(background), b = luminance(foreground);
    return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), foreground, background };
  }, border);
}

try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
    const page = await context.newPage();
    page.on('pageerror', error => observations.pageErrors.push(error.message));
    await page.goto(base);
    const badge = page.getByText('Live Demo', { exact: true }).filter({ visible: true });
    await badge.waitFor();
    const record = { theme, demoBadge: await contrast(badge) };
    await page.goto(`${base}services/agent_demo_01/shop%3Apayment-worker?tab=uptime`);
    const heading = page.getByText('24시간 업타임', { exact: true });
    await heading.waitFor();
    record.firstData = await heading.boundingBox();
    record.bottomNavigation = await page.getByRole('link', { name: '더보기', exact: true }).boundingBox();
    record.timeButtons = await page.getByRole('group', { name: '시간 범위', exact: true }).getByRole('button').evaluateAll(elements => elements.map(element => ({ label: element.textContent, height: element.getBoundingClientRect().height })));
    await page.screenshot({ path: path.join(out, 'screenshots', `uptime-mobile-${theme}.png`) });
    record.collapsedMetadataVisible = await page.locator('dt').first().evaluate(element => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
    await page.locator('summary').filter({ hasText: '서비스 정보' }).click();
    record.expandedMetadataVisible = await page.locator('dt').first().evaluate(element => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
    await page.screenshot({ path: path.join(out, 'screenshots', `metadata-mobile-${theme}.png`) });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}alerts/channels/new`);
    await page.getByLabel('표시 이름', { exact: false }).waitFor();
    record.telegramLabel = await contrast(page.locator('p').filter({ hasText: /^Telegram$/ }));
    record.inputEdge = await contrast(page.getByLabel('표시 이름', { exact: false }), true);
    await page.goto(`${base}services/agent_demo_01/shop%3Apayment-worker?tab=metrics`);
    const search = page.getByPlaceholder('이름 또는 설명으로 지표 찾기');
    await search.waitFor();
    record.searchEdge = await contrast(search, true);
    record.shortControls = await page.locator('button.block').evaluateAll(elements => elements.map(element => ({ text: element.textContent, height: element.getBoundingClientRect().height, visible: element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) })));
    observations.themes.push(record);
    if (theme === 'light') {
      await page.goto(`${base}services/agent_demo_01/shop%3Apayment-worker?tab=logs`);
      const trace = page.locator('[role="button"][aria-expanded]').filter({ hasText: 'deadline exceeded' }).first().getByRole('button', { name: '트레이스', exact: true });
      await trace.focus();
      await trace.press('Enter');
      const dialog = page.getByRole('dialog', { name: '트레이스 상세' });
      await dialog.waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, 'screenshots', 'keyboard-trace-open.png') });
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      observations.keyboard = { opened: true, focusRestored: await trace.evaluate(element => document.activeElement === element) };
      await page.goto(base);
      await page.getByRole('combobox', { name: '데모 시나리오' }).click();
      await page.getByRole('option', { name: '첫 시작', exact: true }).click();
      await page.locator('section').filter({ hasText: '아직 모니터링 대상이 없습니다' }).getByRole('link', { name: 'Docker 연결', exact: true }).click();
      const setup = page.getByRole('dialog');
      await setup.getByLabel('Docker 환경 이름').fill('first-visit-example');
      await setup.getByRole('button', { name: '추가', exact: true }).click();
      await setup.getByText(/예시 설치 화면입니다/).waitFor();
      observations.installation = { alertCount: await setup.getByRole('alert').count(), guide: await setup.getByRole('link', { name: '실제 설치 방법 보기' }).getAttribute('href') };
      await page.screenshot({ path: path.join(out, 'screenshots', 'demo-installation.png') });
      await setup.getByRole('button', { name: '닫기', exact: true }).click();
      observations.installation.pendingRow = await page.getByRole('row').filter({ hasText: 'first-visit-example' }).innerText();
      await page.screenshot({ path: path.join(out, 'screenshots', 'demo-installation-pending.png') });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, 'verified-observations.json'), JSON.stringify(observations, null, 2) + '\n');
}
console.log(JSON.stringify(observations, null, 2));
