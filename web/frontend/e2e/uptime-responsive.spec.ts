import { expect, test } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { menuItem } from './fixtures/menu';
import { dockerService, monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: API_URL, reducedMotion: 'reduce' });

for (const theme of ['light', 'dark']) for (const [width, height] of [[375, 812], [1440, 1000], [812, 375]]) {
  test(`[17] ${theme} ${width}x${height} list/detail/Docker and dialogs contain long content`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    const state = await uptimeFixture(page);
    const name = '업타임-긴이름-'.repeat(12);
    // 모니터가 하나면 서버 탭은 목록 없이 상세를 보인다. 목록 화면을 확인하도록 다른 모니터를 하나 더 둔다.
    state.monitors = [monitor('http-monitor', { name, url: `https://example.com/${'very-long-endpoint-'.repeat(30)}` }), monitor('tcp-monitor', { name: 'Database', type: 'tcp', url: 'db.example.com', port: 5432 })];
    state.services = [dockerService({ name: 'Docker-긴이름-'.repeat(12) })];
    state.metrics[0].errorMessage = '긴 오류 메시지-'.repeat(80);
    state.responses.set('GET /agents/docker-host/services/shop%3Aapi/history', [{ time: new Date().toISOString(), latencyMs: 120, total: 100, uptimePct: 99 }]);
    state.responses.set('GET /agents/docker-host/services/shop%3Aapi/uptime', [{ date: new Date().toLocaleDateString('sv-SE'), uptimePct: 99, healthyChecks: 99000, totalChecks: 100000 }]);
    // 서버 탭의 목록에는 목록 제목이 없다(h1은 서버 이름). 목록은 긴 이름의 행 링크로 확인한다.
    for (const [route, role, title] of [['servers/server-1/uptime', 'link', name], ['servers/server-1/uptime/http-monitor', 'heading', name], ['services/docker-host/shop%3Aapi', 'heading', state.services[0].name]] as const) {
      await page.goto(`./${route}`);
      await expect(page.getByRole(role, { name: title, exact: true })).toBeVisible();
      await expect.poll(() => page.locator('main > div').first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${height}-${route.split('/')[0]}${route.includes('monitor') ? '-detail' : ''}.png`) });
    }
    await page.goto('./servers/server-1/uptime'); await page.getByRole('button', { name: '업타임 모니터 추가', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '업타임 모니터 추가' });
    await dialog.getByRole('combobox').press('ArrowDown');
    const footer = dialog.getByRole('button', { name: '추가', exact: true });
    expect(await dialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1 || ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))).toBe(true);
    await footer.scrollIntoViewIfNeeded();
    const box = await footer.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${height}-create.png`) });
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await page.goto('./servers/server-1/monitors/http-monitor'); await (await menuItem(page, '삭제')).click();
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
  await uptimeFixture(page); await page.goto('./servers/server-1/uptime');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: '업타임 모니터 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 모니터 추가' });
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
  for (const route of ['./servers/server-1/monitors/http-monitor', './servers/docker-host/containers/shop%3Aapi']) {
    await page.goto(route);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { name: route.includes('http-monitor') ? 'Public API' : 'Docker API', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('main > div').first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
  }
});
