import { expect, test } from '@playwright/test';
import { metricsFixture } from './fixtures/metrics';

const detail = 'http://127.0.0.1:4174/metrics/metrics-service';

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

test('the list counts flagged metrics like the detail and puts that service first', async ({ page }) => {
  const state = await metricsFixture(page);
  const fresh = new Date().toISOString();
  state.catalog.splice(0, state.catalog.length,
    { serviceId: 'metrics-service', metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', lastAt: fresh, lastReceivedAt: fresh, breached: true },
    { serviceId: 'metrics-service', metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: fresh, lastReceivedAt: fresh },
    { serviceId: 'waiting-service', metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: fresh, lastReceivedAt: fresh },
  );
  // Name order would put billing-api first anyway; rename it so only the flag can lift it.
  state.service.name = 'zz-billing-api';
  await page.goto('http://127.0.0.1:4174/metrics');
  const rows = page.getByRole('table', { name: '메트릭 서비스 그리드' }).getByRole('row');
  const flagged = rows.nth(1);
  await expect(flagged).toContainText('zz-billing-api');
  await expect(flagged.getByText('1', { exact: true })).toHaveClass(/text-status-error/);
  await expect(flagged).toContainText('임계값 초과');
  await expect(flagged).toContainText('응답 시간');
  await expect(rows.nth(2)).toContainText('이상 없음');

  await page.getByRole('combobox', { name: '서비스 정렬' }).click();
  await page.getByRole('option', { name: '이름순' }).click();
  await expect(rows.nth(1)).toContainText('waiting-worker');
});
