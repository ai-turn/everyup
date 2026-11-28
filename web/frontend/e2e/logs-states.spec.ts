import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import type { LogEntry, ObservedService, Server } from '../src/services/api';

// Real HTTP failures on the log detail — a failed load must not read as "no logs".
test.use({ baseURL: API_URL });

// 서버 화면은 이 서버의 로그 탭(/servers/server-1/logs/<앱>)에서 앱의 로그를 보여 준다.
const server: Server = { id: 'server-1', name: 'web-01', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' };

const service: ObservedService = {
  id: 'logs-test', name: 'checkout-api', serverId: server.id, signals: ['logs'], isActive: true,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
};

const log: LogEntry = {
  id: 1, level: 'error', message: 'Connection timeout', createdAt: new Date().toISOString(),
  metadata: { attributes: { 'http.route': '/api/v1/auth/login' } },
} as LogEntry;

interface LogState { failLogs?: boolean; failHistogram?: boolean; failFilter?: boolean }

async function mockLogs(page: Page, state: LogState) {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const failed = (path.endsWith('/logs') && state.failLogs)
      || (path.endsWith('/log-histogram') && state.failHistogram)
      || (path.endsWith('/log-filter') && state.failFilter);
    if (failed) {
      await route.fulfill({ status: 503, json: { success: false, error: { code: 'DATABASE_ERROR' } } });
      return;
    }
    // 그 밖의 요청(서버 화면이 함께 불러오는 모니터, 인프라, 로그 요약 등)은 빈 목록이다.
    let data: unknown = [];
    if (path === '/servers') data = [server];
    else if (path === `/servers/${server.id}`) data = server;
    else if (path === '/observed-services') data = [service];
    else if (path === `/observed-services/${service.id}`) data = service;
    else if (path.endsWith('/logs')) data = { data: [log], total: 1 };
    else if (path.endsWith('/log-histogram')) data = [{ time: log.createdAt, error: 1, warn: 0, info: 0, debug: 0, trace: 0 }];
    else if (path.endsWith('/log-filter')) data = { levels: ['error', 'warn', 'info'] };
    await route.fulfill({ json: { success: true, data } });
  });
}

test('a failed log load stays distinct from an empty period and recovers on retry', async ({ page }) => {
  const state: LogState = { failLogs: true };
  await mockLogs(page, state);
  await page.goto(`./servers/${server.id}/logs/${service.id}?range=24h`);
  await expect(page.getByText('로그를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(page.getByText('이 기간에 수집된 로그가 없습니다', { exact: true })).toHaveCount(0);
  state.failLogs = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('Connection timeout', { exact: true })).toBeVisible();
});

test('histogram and ingest-level failures say so and retry', async ({ page }) => {
  const state: LogState = { failHistogram: true, failFilter: true };
  await mockLogs(page, state);
  await page.goto(`./servers/${server.id}/logs/${service.id}?range=24h`);
  // 수집 레벨은 앱 페이지 머리말의 접힌 속성 목록에 있다(G안: 자세한 것은 눌러서 본다).
  await expect(page.getByText('로그 발생량을 불러오지 못했습니다', { exact: true })).toBeVisible();
  await page.locator('#main-content header').first().locator('summary').click();
  await expect(page.getByText('불러오지 못했습니다', { exact: true })).toBeVisible();
  state.failHistogram = false;
  state.failFilter = false;
  await page.getByRole('status').filter({ hasText: '로그 발생량을' }).getByRole('button', { name: '다시 시도' }).click();
  await page.getByRole('status').filter({ hasText: /^불러오지 못했습니다/ }).getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('group', { name: /로그 발생량 차트/ })).toBeVisible();
  await expect(page.getByText('error, warn, info', { exact: true })).toBeVisible();
});

test('keyboard picks a histogram slice; rows expand without nested buttons', async ({ page }) => {
  await mockLogs(page, {});
  await page.goto(`./servers/${server.id}/logs/${service.id}?range=24h`);
  const chart = page.getByRole('group', { name: /로그 발생량 차트/ });
  await chart.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /\d{2}:\d{2} ~ \d{2}:\d{2}/ })).toBeVisible();

  await expect(page.locator('main div[role="button"]')).toHaveCount(0);
  const toggle = page.getByRole('button', { name: '로그 상세 펼치기' });
  await toggle.click();
  await expect(page.getByRole('button', { name: '로그 상세 접기' })).toHaveAttribute('aria-expanded', 'true');
});
