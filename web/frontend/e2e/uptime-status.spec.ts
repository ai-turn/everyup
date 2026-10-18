import { expect, test, type Page } from '@playwright/test';
import type { AgentServiceFlat, UptimeMonitor } from '../src/services/api';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

function monitor(id: string, status: UptimeMonitor['status'], isActive = true): UptimeMonitor {
  return { id, name: id, type: 'http', isActive, url: `https://${id}.example.com`, method: 'GET', expectedStatus: 200, timeout: 10, interval: 60, status };
}

function service(name: string, healthy = true): AgentServiceFlat {
  return { agentId: 'docker-test', agentName: 'prod-server', key: name, name, checkType: 'http', endpoint: `http://${name}:8080`, healthy, seen: true, silenced: false, observedAt: new Date().toISOString() };
}

interface UptimeState {
  monitors: UptimeMonitor[];
  services: AgentServiceFlat[];
  failed: ('services' | 'monitors')[];
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
    const source = path === '/api/v1/agents/services/all' ? 'services' : path === '/api/v1/services' ? 'monitors' : null;
    await route.fulfill(source && state.failed.includes(source) ? {
      status: 503, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } },
    } : {
      json: { success: true, data: source ? state[source] : [] },
    });
  });
}

test('active waiting checks and paused monitors stay distinct in the summary and targets', async ({ page }) => {
  await mockUptimeApi(page, {
    monitors: [monitor('healthy-monitor', 'healthy'), monitor('failed-monitor', 'unhealthy'), monitor('waiting-monitor', 'unknown'), monitor('paused-monitor', 'unknown', false)],
    services: [service('healthy-docker'), service('failed-docker', false)], failed: [],
  });
  await page.goto('./uptime');
  const summary = page.getByRole('region', { name: '업타임 상태 요약' });
  await expect(summary).toContainText('일시정지 1개 · 확인 대기 1개');
  await expect(summary).not.toContainText('체크가 돌지 않는 대상입니다');
  for (const [name, label] of [['healthy-monitor', '정상'], ['failed-monitor', '장애'], ['waiting-monitor', '확인 대기'], ['paused-monitor', '일시정지']]) {
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) }).getByText(label, { exact: true })).toBeVisible();
  }
  await expect(summary.locator('dd')).toHaveText(['2', '2', '2']);
});

for (const source of ['services', 'monitors'] as const) {
  test(`${source} failure preserves the other source and recovers on retry`, async ({ page }) => {
    const state: UptimeState = { monitors: [monitor('healthy-monitor', 'healthy')], services: [service('healthy-docker')], failed: [source] };
    await mockUptimeApi(page, state);
    await page.goto('./uptime');
    const successfulTarget = source === 'services' ? 'healthy-monitor' : 'healthy-docker';
    const failedLabel = source === 'services' ? 'Docker 서비스' : '업타임 모니터';
    await expect(page.getByRole('link', { name: successfulTarget, exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(failedLabel);
    await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toHaveCount(0);
    await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toHaveCount(0);
    state.failed = [];
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('link', { name: 'healthy-monitor', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'healthy-docker', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toBeVisible();
  });

  test(`${source} failure with an empty successful source is not a globally empty list`, async ({ page }) => {
    await mockUptimeApi(page, { monitors: [], services: [], failed: [source] });
    await page.goto('./uptime');
    await expect(page.getByRole('status')).toContainText(source === 'services' ? 'Docker 서비스' : '업타임 모니터');
    await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toHaveCount(0);
  });
}

test('both failed sources stay unknown rather than showing empty or healthy', async ({ page }) => {
  await mockUptimeApi(page, { monitors: [], services: [], failed: ['services', 'monitors'] });
  await page.goto('./uptime');
  await expect(page.getByRole('status')).toContainText('Docker 서비스');
  await expect(page.getByRole('status')).toContainText('업타임 모니터');
  await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '업타임 상태 요약' })).toHaveCount(0);
});

test('successful empty sources show the genuine empty state', async ({ page }) => {
  await mockUptimeApi(page, { monitors: [], services: [], failed: [] });
  await page.goto('./uptime');
  await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

for (const source of ['services', 'monitors'] as const) {
  test(`${source} failed refresh retains previous targets without presenting stale health as current`, async ({ page }) => {
    const state: UptimeState = { monitors: [monitor('healthy-monitor', 'healthy')], services: [service('healthy-docker')], failed: [] };
    await mockUptimeApi(page, state);
    await page.goto('./uptime');
    await expect(page.getByRole('link', { name: 'healthy-docker', exact: true })).toBeVisible();
    state.failed = [source];
    await page.getByRole('button', { name: 'healthy-monitor 일시정지', exact: true }).click();
    const staleCard = page.getByRole('row').filter({ has: page.getByRole('link', { name: source === 'services' ? 'healthy-docker' : 'healthy-monitor', exact: true }) });
    await expect(staleCard.getByText('확인 불가', { exact: true })).toBeVisible();
    await expect(staleCard.getByText('정상', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('이전에 불러온');
    if (source === 'services') {
      await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: 'healthy-monitor', exact: true }) }).getByText('일시정지', { exact: true })).toBeVisible();
    } else {
      await expect(staleCard.getByRole('button')).toBeDisabled();
      await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: 'healthy-docker', exact: true }) }).getByText('정상', { exact: true })).toBeVisible();
    }
    state.failed = [];
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(staleCard.getByText(source === 'services' ? '정상' : '일시정지', { exact: true })).toBeVisible();
    if (source === 'monitors') await expect(staleCard.getByRole('button')).toBeEnabled();
    await expect(page.getByRole('status')).toHaveCount(0);
  });
}
