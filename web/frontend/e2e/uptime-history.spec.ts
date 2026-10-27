import { expect, test } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });
for (const timezoneId of ['Asia/Seoul', 'America/New_York']) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId, viewport: { width: 375, height: 812 } });
    test('[13] calendar days, boundaries, status counts and keyboard/hover match across DST', async ({ page }) => {
      await page.clock.install({ time: new Date('2026-05-01T12:00:00Z') });
      const state = await uptimeFixture(page);
      state.responses.set('GET /services/http-monitor/uptime', { percentage: 88.75, days: [
        { date: '2026-01-31', uptime: 0 }, { date: '2026-02-01', uptime: 0 },
        { date: '2026-03-01', uptime: 99.4 }, { date: '2026-03-08', uptime: 99.5 },
        { date: '2026-04-30', uptime: 50 }, { date: '2026-05-01', uptime: 100 }, { date: '2026-05-02', uptime: 0 },
      ] });
      await page.goto('./uptime/http-monitor');
      const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: '업타임 현황', exact: true }) });
      const strip = overview.getByRole('group');
      const bars = strip.locator(':scope > div');
      await expect(bars).toHaveCount(90);
      for (const [index, tone] of [[0, 'error'], [28, 'warn'], [35, 'healthy'], [88, 'warn'], [89, 'healthy']] as const) await expect(bars.nth(index)).toHaveClass(new RegExp(`bg-status-${tone}`));
      await expect(bars.nth(1)).toHaveClass(/bg-ui-hover/);
      await expect(overview.getByText('일부 실패 2일, 전체 실패 1일', { exact: true })).toBeVisible();
      await expect(overview.getByText('88.75%', { exact: true })).toBeVisible();
      await strip.focus(); await strip.press('Home');
      const caption = overview.locator('[aria-live="polite"]');
      await expect(caption).toContainText('2026-02-01 0.0% 업타임');
      await strip.press('ArrowRight');
      await expect(caption).toContainText('2026-02-02 기록 없음');
      await strip.press('End');
      await expect(caption).toContainText('2026-05-01 100.0% 업타임');
      await strip.press('ArrowLeft');
      await expect(caption).toContainText('2026-04-30 50.0% 업타임');
      await bars.nth(28).hover();
      await expect(caption).toContainText('2026-03-01 99.4% 업타임');
      expect(await caption.locator('span').filter({ hasText: '2026-03-01' }).first().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    });
  });
}

test('[13] zero history is explicitly unknown rather than zero uptime', async ({ page }) => {
  const state = await uptimeFixture(page); state.history = { percentage: 0, days: [] };
  state.summary = { ...state.summary!, totalChecks: 0, failedChecks: 0, successfulChecks: 0, uptime: 0 };
  await page.goto('./uptime/http-monitor');
  const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: '업타임 현황', exact: true }) });
  await expect(overview.locator('dl > div').filter({ hasText: '30일 업타임' }).locator('dd')).toHaveText('-');
  await expect(overview.locator('dl > div').filter({ hasText: '24시간 업타임' }).locator('dd')).toHaveText('-');
  await expect(overview.locator('dl > div').filter({ hasText: '평균 응답' }).locator('dd')).toHaveText('-');
  const strip = overview.getByRole('group'); await strip.focus();
  await expect(overview.locator('[aria-live="polite"]')).toContainText('기록 없음');
  await expect(overview.getByText('기록 0/90일', { exact: true })).toBeVisible();
});
