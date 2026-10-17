import { expect, test, type Page } from '@playwright/test';
import type { ConnectedAgent, TimelineIncident } from '../src/services/api';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

const incident: TimelineIncident = {
  source: 'uptime',
  targetName: 'Storefront',
  targetPath: '/uptime/storefront',
  startedAt: '2026-10-16T00:00:00Z',
  endedAt: '2026-10-16T00:42:00Z',
  durationSec: 2520,
  active: false,
  message: 'HTTP 503 from origin',
};

interface OverviewApiState {
  failed: boolean;
  incidents: TimelineIncident[];
  beforeTimelineResponse?: () => Promise<void>;
}

async function mockOverviewApi(page: Page, state: OverviewApiState) {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/incidents/timeline') {
      await state.beforeTimelineResponse?.();
      await route.fulfill(state.failed ? {
        status: 503,
        json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Timeline unavailable' } },
      } : {
        json: { success: true, data: state.incidents },
      });
      return;
    }

    const now = new Date().toISOString();
    const agents: ConnectedAgent[] = [{ id: 'overview-test', name: 'prod-server', lastSeenAt: now, createdAt: now, updatedAt: now }];
    await route.fulfill({ json: { success: true, data: pathname === '/api/v1/agents' ? agents : [] } });
  });
}

test('timeline fetch failure stays unknown and recovers on retry', async ({ page }) => {
  const state = { failed: true, incidents: [incident] };
  await mockOverviewApi(page, state);
  await page.goto('./');

  const timeline = page.getByRole('region', { name: '최근 장애 이력' });
  await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
  await expect(timeline.getByText('장애 이력을 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(timeline.getByLabel('최근 장애 확인 불가')).toHaveText('—');
  await expect(timeline).not.toContainText('최근 7일간 기록된 장애가 없습니다');
  await expect(timeline).not.toContainText('중단 없이 동작했습니다');
  await expect(page.locator('main').getByRole('link', { name: 'Docker 환경 1', exact: true })).toBeVisible();

  state.failed = false;
  await timeline.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(timeline.getByRole('link', { name: /Storefront/ })).toBeVisible();
  await expect(timeline.getByLabel('최근 장애 1건')).toHaveText('1');
  await expect(timeline.getByRole('status')).toHaveCount(0);
  await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toHaveCount(0);
});

for (const retryFails of [true, false]) {
  test(`retry shares pending feedback and unlocks after ${retryFails ? 'failure' : 'success'}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state: OverviewApiState = { failed: true, incidents: [incident] };
    await mockOverviewApi(page, state);
    await page.goto('./');
    const retries = page.getByRole('button', { name: '다시 시도', exact: true });
    await expect(retries).toHaveCount(2);
    const initialWidths = await retries.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width));
    let releaseResponse = () => {};
    const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
    let requests = 0;
    state.beforeTimelineResponse = async () => { requests++; await pendingResponse; };

    try {
      await retries.first().click();
      await expect.poll(() => requests).toBe(1);
      for (const retry of await retries.all()) {
        await expect(retry).toBeDisabled();
        await expect(retry).toHaveAttribute('aria-busy', 'true');
        await expect(retry).toHaveText('다시 시도');
        const bounds = await retry.boundingBox();
        await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      }
      const pendingWidths = await retries.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width));
      expect(pendingWidths).toEqual(initialWidths);
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(requests).toBe(1);
      await expect(page.getByRole('heading', { name: '모니터링 범위' })).toBeVisible();
      state.failed = retryFails;
      releaseResponse();

      if (retryFails) {
        for (const retry of await retries.all()) {
          await expect(retry).toBeEnabled();
          await expect(retry).not.toHaveAttribute('aria-busy');
        }
        state.failed = false;
        await retries.last().click();
      }
      await expect(page.getByRole('region', { name: '최근 장애 이력' }).getByRole('link', { name: /Storefront/ })).toBeVisible();
      await expect(retries).toHaveCount(0);
      expect(requests).toBe(retryFails ? 2 : 1);
    } finally {
      releaseResponse();
    }
  });
}

test('successful empty timeline reports recorded history without promising uptime', async ({ page }) => {
  await mockOverviewApi(page, { failed: false, incidents: [] });
  await page.goto('./');

  const timeline = page.getByRole('region', { name: '최근 장애 이력' });
  await expect(timeline.getByText('최근 7일간 기록된 장애가 없습니다', { exact: true })).toBeVisible();
  await expect(timeline.getByLabel('최근 장애 0건')).toHaveText('0');
  await expect(timeline.getByRole('status')).toHaveCount(0);
  await expect(timeline).not.toContainText('중단 없이 동작했습니다');
});

test('failed refresh labels retained timeline records as previous data', async ({ page }) => {
  const state = { failed: false, incidents: [incident] };
  await mockOverviewApi(page, state);
  await page.goto('./');

  const timeline = page.getByRole('region', { name: '최근 장애 이력' });
  await expect(timeline.getByRole('link', { name: /Storefront/ })).toBeVisible();
  state.failed = true;
  await page.getByRole('button', { name: '새로고침', exact: true }).click();

  await expect(timeline.getByRole('status')).toContainText('이전에 불러온 기록입니다. 최신 기록은 확인할 수 없습니다.');
  await expect(timeline.getByRole('link', { name: /Storefront/ })).toBeVisible();
  await expect(timeline.getByLabel('최근 장애 확인 불가')).toHaveText('—');
  await expect(page.getByText('현재 확인이 필요한 이상이 없습니다')).toBeVisible();

  state.failed = false;
  state.incidents = [];
  await timeline.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(timeline.getByRole('status')).toHaveCount(0);
  await expect(timeline.getByRole('link')).toHaveCount(0);
  await expect(timeline.getByLabel('최근 장애 0건')).toHaveText('0');
});
