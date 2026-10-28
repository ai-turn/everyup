import { expect, test } from '@playwright/test';
import { monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('outage history lists the monitor episodes with state and duration', async ({ page }) => {
  const state = await uptimeFixture(page);
  const now = Date.now();
  state.responses.set('GET /services/http-monitor/incidents', [
    { source: 'uptime', targetName: 'Public API', targetPath: '/uptime/http-monitor', startedAt: new Date(now - 600_000).toISOString(), durationSec: 600, active: true, message: 'connection refused' },
    { source: 'uptime', targetName: 'Public API', targetPath: '/uptime/http-monitor', startedAt: new Date(now - 5 * 3_600_000).toISOString(), endedAt: new Date(now - 4 * 3_600_000).toISOString(), durationSec: 3600, active: false, message: '503 from origin' },
  ]);
  await page.goto('./uptime/http-monitor');
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: '장애 이력', exact: true }) });
  const rows = section.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('진행 중');
  await expect(rows.first()).toContainText('10분');
  await expect(rows.nth(1)).toContainText('복구');
  await expect(rows.nth(1)).toContainText('1시간 0분');
  await expect(rows.nth(1)).toContainText('503 from origin');
});

test('no outages reads as none, not as an error', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./uptime/http-monitor');
  await expect(page.getByText('최근 90일 동안 기록된 장애가 없습니다', { exact: true })).toBeVisible();
});

test('6H switches the response chart to server buckets', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.responses.set('GET /services/http-monitor/metrics/history', [
    { time: new Date(Date.now() - 600_000).toISOString(), latencyMs: 120, uptimePct: 50, total: 2 },
  ]);
  await page.goto('./uptime/http-monitor');
  await page.getByRole('group', { name: '응답 시간 범위' }).getByRole('button', { name: '6H' }).click();
  const chart = page.locator('section').filter({ has: page.getByRole('heading', { name: '응답 시간', exact: true }) });
  await expect(chart.getByText('최근 6시간, 5분 단위, ms')).toBeVisible();
  await expect(chart.locator('[aria-live="polite"]')).toContainText('실패 1회');
  expect(state.requests.some((request) => request.path === '/services/http-monitor/metrics/history' && request.query === '?range=6h')).toBe(true);
});

test('certificate expiry and expected status show in the header, and the status code is editable', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors = [monitor('http-monitor', { certExpiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString() })];
  await page.goto('./uptime/http-monitor');
  // Certificate expiry is the fourth overview number for HTTPS monitors, coloured only near expiry.
  const cert = page.locator('dl > div').filter({ hasText: '인증서 만료' }).locator('dd');
  await expect(cert).toHaveText('D-5');
  await expect(cert).toHaveClass(/text-status-warn/);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 수정' });
  const expected = dialog.getByRole('spinbutton', { name: '기대 상태 코드' });
  await expect(expected).toHaveValue('200');
  await expected.fill('204');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const put = state.requests.find((request) => request.method === 'PUT');
  expect(put?.body).toMatchObject({ expectedStatus: 204 });
});

test('TCP monitors have no expected status field or header entry', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./uptime/tcp-monitor');
  await expect(page.getByText('기대 상태 코드', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '업타임 수정' }).getByRole('spinbutton', { name: '기대 상태 코드' })).toHaveCount(0);
});

test('outage history merges outages with failures that never became one, and filters by kind and day', async ({ page }) => {
  const state = await uptimeFixture(page);
  const now = Date.now();
  const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE');
  state.history = { percentage: 99, days: [{ date: day(now), status: 'up', uptime: 100 }, { date: day(now - 2 * 86_400_000), status: 'partial', uptime: 98 }] };
  state.responses.set('GET /services/http-monitor/incidents', [
    { source: 'uptime', targetName: 'Public API', targetPath: '/uptime/http-monitor', startedAt: new Date(now - 2 * 86_400_000).toISOString(), endedAt: new Date(now - 2 * 86_400_000 + 1_800_000).toISOString(), durationSec: 1800, active: false, message: 'connection refused' },
  ]);
  state.responses.set('GET /services/http-monitor/failures', [
    { id: 9, serviceId: 'http-monitor', status: 'failure', responseTime: 600, statusCode: 503, errorMessage: 'upstream connect error', checkedAt: new Date(now - 600_000).toISOString() },
  ]);
  await page.goto('./uptime/http-monitor');
  const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: '장애 이력', exact: true }) });
  const rows = overview.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('실패');
  await expect(rows.first()).toContainText('HTTP 503, upstream connect error');
  await expect(rows.nth(1)).toContainText('장애 복구');
  await overview.getByRole('group', { name: '장애 이력 구분' }).getByRole('button', { name: '장애', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('connection refused');
  await overview.getByRole('group', { name: '장애 이력 구분' }).getByRole('button', { name: '전체', exact: true }).click();
  // Picking the outage's day in the 90-day strip keeps only that day.
  const strip = overview.getByRole('group', { name: /최근 90일/ });
  await strip.locator(':scope > div').nth(87).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('connection refused');
  await overview.getByRole('button', { name: `${day(now - 2 * 86_400_000)} 선택 해제` }).click();
  await expect(rows).toHaveCount(2);
});
