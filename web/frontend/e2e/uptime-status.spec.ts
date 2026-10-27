import { expect, test, type Page } from '@playwright/test';
import type { UptimeMonitor } from '../src/services/api';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

// Uptime reads independent monitors only; Docker checks are in their Docker Environment (ADR 0007).

function monitor(id: string, status: UptimeMonitor['status'], isActive = true): UptimeMonitor {
  return { id, name: id, type: 'http', isActive, url: `https://${id}.example.com`, method: 'GET', expectedStatus: 200, timeout: 10, interval: 60, status };
}

interface UptimeState {
  monitors: UptimeMonitor[];
  failed: boolean;
}

async function mockUptimeApi(page: Page, state: UptimeState) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'PUT') {
      const input = route.request().postDataJSON() as { isActive: boolean };
      state.monitors = state.monitors.map((item) => path.endsWith(`/${item.id}`) ? { ...item, isActive: input.isActive } : item);
      await route.fulfill({ json: { success: true, data: state.monitors[0] } });
      return;
    }
    const monitors = path === '/api/v1/services';
    await route.fulfill(monitors && state.failed ? {
      status: 503, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } },
    } : {
      json: { success: true, data: monitors ? state.monitors : [] },
    });
  });
}

test('active waiting checks and paused monitors stay distinct in the summary and targets', async ({ page }) => {
  await mockUptimeApi(page, {
    monitors: [monitor('healthy-monitor', 'healthy'), monitor('failed-monitor', 'unhealthy'), monitor('waiting-monitor', 'unknown'), monitor('paused-monitor', 'unknown', false)],
    failed: false,
  });
  await page.goto('./uptime');
  const summary = page.getByRole('region', { name: '업타임 상태 요약' });
  for (const [name, label] of [['healthy-monitor', '정상'], ['failed-monitor', '장애'], ['waiting-monitor', '확인 대기'], ['paused-monitor', '일시정지']]) {
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) }).getByText(label, { exact: true })).toBeVisible();
  }
  // 정상 · 장애 · 확인 대기 · 일시정지 — 대기와 정지를 합치지 않는다.
  await expect(summary.getByRole('button')).toHaveText([/정상\s*1/, /장애\s*1/, /확인 대기\s*1/, /일시정지\s*1/]);
});

test('a load failure stays unknown rather than empty and recovers on retry', async ({ page }) => {
  const state: UptimeState = { monitors: [monitor('healthy-monitor', 'healthy')], failed: true };
  await mockUptimeApi(page, state);
  await page.goto('./uptime');
  await expect(page.getByRole('status')).toContainText('업타임 모니터');
  await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toHaveCount(0);
  await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toHaveCount(0);
  state.failed = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('link', { name: 'healthy-monitor', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toBeVisible();
});

test('a successful empty registry shows the genuine empty state', async ({ page }) => {
  await mockUptimeApi(page, { monitors: [], failed: false });
  await page.goto('./uptime');
  await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('a failed refresh retains previous targets without presenting stale health as current', async ({ page }) => {
  const state: UptimeState = { monitors: [monitor('healthy-monitor', 'healthy')], failed: false };
  await mockUptimeApi(page, state);
  await page.goto('./uptime');
  await expect(page.getByRole('link', { name: 'healthy-monitor', exact: true })).toBeVisible();
  state.failed = true;
  await page.getByRole('button', { name: 'healthy-monitor 일시정지', exact: true }).click();
  const staleCard = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'healthy-monitor', exact: true }) });
  await expect(staleCard.getByText('확인 불가', { exact: true })).toBeVisible();
  await expect(staleCard.getByText('정상', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('이전에 불러온');
  await expect(staleCard.getByRole('button')).toBeDisabled();
  state.failed = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(staleCard.getByText('일시정지', { exact: true })).toBeVisible();
  await expect(staleCard.getByRole('button')).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
});
