import { expect, test, type Page } from '@playwright/test';
import type { UptimeMonitor } from '../src/services/api';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

// Uptime reads independent monitors only; Docker checks are in their Docker Environment (ADR 0007).

const server = { id: 'server-1', name: 'web-01', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' };
const panel = (page: Page) => page.getByRole('tabpanel');

function monitor(id: string, status: UptimeMonitor['status'], isActive = true): UptimeMonitor {
  return { id, name: id, serverId: server.id, type: 'http', isActive, url: `https://${id}.example.com`, method: 'GET', expectedStatus: 200, timeout: 10, interval: 60, status };
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
    // 서버 화면은 서버 목록과 함께 모니터를 불러온다. 나머지 대상(앱, 인프라, 그룹, 로그 요약)은 비어 있다.
    await route.fulfill(monitors && state.failed ? {
      status: 503, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } },
    } : {
      json: { success: true, data: monitors ? state.monitors : path === '/api/v1/servers' ? [server] : [] },
    });
  });
}

test('active waiting checks and paused monitors stay distinct in the summary and targets', async ({ page }) => {
  await mockUptimeApi(page, {
    monitors: [monitor('healthy-monitor', 'healthy'), monitor('failed-monitor', 'unhealthy'), monitor('waiting-monitor', 'unknown'), monitor('paused-monitor', 'unknown', false)],
    failed: false,
  });
  await page.goto('./servers/server-1/uptime');
  const summary = page.getByRole('region', { name: '업타임 상태 요약' });
  for (const [name, label] of [['healthy-monitor', '정상'], ['failed-monitor', '장애'], ['waiting-monitor', '확인 대기'], ['paused-monitor', '일시정지']]) {
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) }).getByText(label, { exact: true })).toBeVisible();
  }
  // 장애를 먼저 보이며, 대기와 정지는 따로 센다.
  await expect(summary.getByRole('button')).toHaveText([/장애\s*1/, /정상\s*1/, /확인 대기\s*1/, /일시정지\s*1/]);
});

test('a load failure stays unknown rather than empty and recovers on retry', async ({ page }) => {
  // 모니터가 하나면 서버 탭은 목록 없이 상세를 보인다. 목록을 확인하도록 둘을 둔다.
  const state: UptimeState = { monitors: [monitor('healthy-monitor', 'healthy'), monitor('other-monitor', 'healthy')], failed: true };
  await mockUptimeApi(page, state);
  await page.goto('./servers/server-1/uptime');
  await expect(panel(page).getByRole('alert')).toContainText('업타임 모니터');
  await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toHaveCount(0);
  await expect(page.getByText('이 서버의 업타임 모니터를 추가하세요', { exact: true })).toHaveCount(0);
  state.failed = false;
  await panel(page).getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('link', { name: 'healthy-monitor', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toBeVisible();
});

test('a successful empty registry shows the genuine empty state', async ({ page }) => {
  await mockUptimeApi(page, { monitors: [], failed: false });
  await page.goto('./servers/server-1/uptime');
  await expect(page.getByText('이 서버의 업타임 모니터를 추가하세요', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

// 모니터 목록을 다시 불러오지 못하면 이전 목록을 "확인 불가"로 남기고 "이전에 불러온" 안내를 보인다(설계 6.7절).
// 안내는 서버 머리말 아래의 일부 실패 안내 하나이다(목록 위에 두 번째 안내를 그리지 않는다).
test('a failed refresh retains previous targets without presenting stale health as current', async ({ page }) => {
  const state: UptimeState = { monitors: [monitor('healthy-monitor', 'healthy'), monitor('other-monitor', 'healthy')], failed: false };
  await mockUptimeApi(page, state);
  await page.goto('./servers/server-1/uptime');
  await expect(page.getByRole('link', { name: 'healthy-monitor', exact: true })).toBeVisible();
  state.failed = true;
  await page.getByRole('button', { name: 'healthy-monitor 일시정지', exact: true }).click();
  const staleCard = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'healthy-monitor', exact: true }) });
  await expect(staleCard.getByText('확인 불가', { exact: true })).toBeVisible();
  await expect(staleCard.getByText('정상', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' })).toContainText('이전에 불러온');
  await expect(staleCard.getByRole('button', { name: 'healthy-monitor 일시정지', exact: true })).toBeDisabled();
  state.failed = false;
  await page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' }).getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(staleCard.getByText('일시정지', { exact: true })).toBeVisible();
  await expect(staleCard.getByRole('button', { name: 'healthy-monitor 재개', exact: true })).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' })).toHaveCount(0);
});
