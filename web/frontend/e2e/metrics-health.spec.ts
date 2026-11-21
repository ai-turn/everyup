import { expect, test } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { metricsFixture } from './fixtures/metrics';

// 서버 화면의 메트릭 탭. 이 서버에는 메트릭 앱이 둘이라 주소에 앱을 둔다.
const detail = `${API_URL}servers/server-1/metrics/metrics-service`;

test('all-metric health includes an unrendered metric and pins survive reload', async ({ page }) => {
  const state = await metricsFixture(page);
  for (let i = 0; i < 20; i++) state.names.push({ metricName: `custom.${String(i).padStart(2, '0')}`, metricType: 'gauge', lastAt: state.service.createdAt, lastReceivedAt: state.service.createdAt, breached: i === 19 });
  await page.goto(detail);
  await expect(page.locator('.recharts-wrapper')).toHaveCount(12);
  const attention = page.getByLabel('확인이 필요한 메트릭');
  await attention.getByRole('button').filter({ hasText: 'custom.19' }).click();
  await expect(page.getByRole('heading', { name: 'custom.19', exact: true })).toBeVisible();
  await expect(page.getByText('임계값 초과', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'custom.19 고정', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'custom.19 고정 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '전체 메트릭', exact: true }).click();
  await expect(page.getByRole('region', { name: '고정한 지표', exact: true }).getByRole('heading', { name: 'custom.19', exact: true })).toBeVisible();
});

test('duplicate names require an explicit type and unit and preserve them in the URL', async ({ page }) => {
  const state = await metricsFixture(page);
  state.names.push({ metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'MB', lastAt: state.service.createdAt, conflicting: true });
  await page.goto(`${detail}?metric=jvm.memory.used`);
  await expect(page.getByText('같은 이름의 타입·단위가 여러 개입니다. 조회할 지표를 선택해 주세요.')).toBeVisible();
  await page.getByRole('button', { name: 'jvm.memory.used gauge MB', exact: true }).click();
  await expect(page).toHaveURL(/metricUnit=MB/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'JVM 메모리 사용량', exact: true })).toBeVisible();
});

test('a new receipt does not disguise an old measurement and health failures stay visible', async ({ page }) => {
  const state = await metricsFixture(page);
  state.names[0].lastReceivedAt = state.service.createdAt;
  await page.goto(`${detail}?metric=jvm.memory.used`);
  const meta = page.getByLabel('메트릭 정보');
  await expect(meta.locator('time').first()).toHaveAttribute('datetime', '2026-10-01T00:00:00Z');
  await expect(meta.locator('time').nth(1)).toHaveAttribute('datetime', state.service.createdAt);
  await expect(page.getByText('측정 지연', { exact: true })).toBeVisible();
  state.failures.add('/observed-services/metrics-service/otel-metrics/health');
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '이전 상태를 표시합니다' })).toBeVisible();
  state.failures.clear();
  await page.getByRole('button', { name: '목록 다시 시도', exact: true }).click();
  await expect(page.getByText('메트릭 상태를 새로고침하지 못했습니다. 이전 상태를 표시합니다.')).toHaveCount(0);
});

// 임계값을 넘은 지표가 있는 앱은 메트릭 기능에서 확인 필요다. 옛 메트릭 목록처럼 그 앱이 먼저 열리고 앱 선택에 그 까닭이 보인다.
test('the metrics tab opens the app with a flagged metric first and marks it in the app selector', async ({ page }) => {
  const state = await metricsFixture(page);
  const fresh = new Date().toISOString();
  state.names.splice(0, state.names.length,
    { metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', lastAt: fresh, lastReceivedAt: fresh, breached: true },
    { metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: fresh, lastReceivedAt: fresh },
  );
  state.catalog.splice(0, state.catalog.length,
    { serviceId: 'metrics-service', metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', lastAt: fresh, lastReceivedAt: fresh, breached: true },
    { serviceId: 'metrics-service', metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: fresh, lastReceivedAt: fresh },
    { serviceId: 'waiting-service', metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: fresh, lastReceivedAt: fresh },
  );
  // 두 앱 모두 수신 중이라 수신 여부로는 같은 상태다. 이름순이면 waiting-worker가 먼저이므로 임계값만이 이 앱을 앞에 둘 수 있다.
  state.service.name = 'zz-billing-api';
  state.service.lastSeenAt = fresh;
  state.waiting.lastSeenAt = fresh;
  await page.goto(`${API_URL}servers/server-1/metrics`);
  await expect(page).toHaveURL(/\/servers\/server-1\/metrics\/metrics-service$/);
  const selector = page.getByRole('group', { name: '메트릭 앱', exact: true });
  await expect(selector.getByRole('button', { name: /zz-billing-api/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(selector).toContainText('임계값 초과');
  await expect(page.getByRole('heading', { level: 2, name: 'zz-billing-api', exact: true })).toBeVisible();
});
