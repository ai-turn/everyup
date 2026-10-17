import { expect, test } from '@playwright/test';
import { dockerService, monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/', reducedMotion: 'reduce' });

for (const theme of ['light', 'dark']) for (const [width, height] of [[375, 812], [1440, 1000], [812, 375]]) {
  test(`[17] ${theme} ${width}x${height} list/detail/Docker and dialogs contain long content`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    const state = await uptimeFixture(page);
    const name = '업타임-긴이름-'.repeat(12);
    state.monitors = [monitor('http-monitor', { name, url: `https://example.com/${'very-long-endpoint-'.repeat(30)}` })];
    state.services = [dockerService({ name: 'Docker-긴이름-'.repeat(12) })];
    state.metrics[0].errorMessage = '긴 오류 메시지-'.repeat(80);
    state.responses.set('GET /agents/docker-host/services/shop%3Aapi/history', [{ time: new Date().toISOString(), latencyMs: 120, total: 100, uptimePct: 99 }]);
    state.responses.set('GET /agents/docker-host/services/shop%3Aapi/uptime', [{ date: new Date().toLocaleDateString('sv-SE'), uptimePct: 99, healthyChecks: 99000, totalChecks: 100000 }]);
    for (const [route, title] of [['uptime', '업타임'], ['uptime/http-monitor', name], ['services/docker-host/shop%3Aapi', state.services[0].name]]) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect.poll(() => page.locator('main > div').first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${height}-${route.split('/')[0]}${route.includes('monitor') ? '-detail' : ''}.png`) });
    }
    await page.goto('./uptime'); await page.getByRole('button', { name: '추가', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '업타임 추가' });
    await dialog.getByRole('combobox').press('ArrowDown');
    const footer = dialog.getByRole('button', { name: '추가', exact: true });
    expect(await dialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1 || ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))).toBe(true);
    await footer.scrollIntoViewIfNeeded();
    const box = await footer.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${height}-create.png`) });
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await page.goto('./uptime/http-monitor'); await page.getByRole('button', { name: '삭제', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '업타임을 삭제할까요?' });
    await confirm.getByRole('button', { name: '취소', exact: true }).scrollIntoViewIfNeeded();
    const cancelBox = await confirm.getByRole('button', { name: '취소', exact: true }).boundingBox();
    expect(cancelBox!.y).toBeGreaterThanOrEqual(0); expect(cancelBox!.y + cancelBox!.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${height}-delete.png`) });
    expect(errors).toEqual([]);
  });
}

test('[17] 200 percent root text, long errors and a short viewport keep forms and controls reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await uptimeFixture(page); await page.goto('./uptime');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: '추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  const submit = dialog.getByRole('button', { name: '추가', exact: true });
  expect(await dialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1 || ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))).toBe(true);
  await submit.scrollIntoViewIfNeeded();
  const box = await submit.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  const name = dialog.getByRole('textbox', { name: '이름', exact: true });
  expect(await name.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(28);
  await name.fill('큰 글자 모니터'); await name.scrollIntoViewIfNeeded();
  await expect(name).toBeInViewport();
  const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('text-200-create.png') });
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  for (const route of ['./uptime/http-monitor', './services/docker-host/shop%3Aapi']) {
    await page.goto(route);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { name: route.includes('http-monitor') ? 'Public API' : 'Docker API', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('main > div').first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
  }
});
