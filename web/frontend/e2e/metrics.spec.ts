import { expect, test } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { metricDisplayUnit, niceTicks } from '../src/components/charts/chartTheme';
import { metricsFixture } from './fixtures/metrics';

test('metric values are scaled to a readable unit before ticks are picked', () => {
  expect(metricDisplayUnit('s', 0.08)).toEqual({ unit: 'ms', factor: 1000 });
  expect(metricDisplayUnit('s', 2.5)).toEqual({ unit: 's', factor: 1 });
  expect(metricDisplayUnit('ms', 4200)).toEqual({ unit: 's', factor: 0.001 });
  // Decimal nice ticks drawn in binary units read 95.4MB · 190.7MB — scale first.
  const bytes = metricDisplayUnit('By', 340_000_000);
  expect(bytes.unit).toBe('MB');
  expect(niceTicks(340_000_000 * bytes.factor)).toEqual([0, 100, 200, 300, 400]);
  expect(metricDisplayUnit('By', 0).unit).toBe('B');
  expect(metricDisplayUnit('1', 0.12).unit).toBe('');
  expect(metricDisplayUnit('{request}', 3).unit).toBe('');
});

// 데모: catalog-worker는 db-primary-01의 하나뿐인 메트릭 앱이다(SCENARIOS.md). 서버의 메트릭 탭은 앱 목록이다.
test('the metrics tab of an app shows every metric at once and a panel title opens that metric alone', async ({ page }) => {
  await page.goto('./servers/server_mock_db_primary_01/metrics');
  await page.getByRole('table', { name: '메트릭 앱' }).getByRole('link', { name: 'catalog-worker' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'catalog-worker', exact: true })).toBeVisible();
  const panels = ['처리 중인 요청', '응답 시간', 'JVM 메모리 사용량'];
  for (const name of panels) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('gauge, MB', { exact: true })).toBeVisible();
  await expect(page.getByText('histogram, 수신 평균, ms', { exact: true })).toBeVisible();

  // A panel's title opens that metric alone, with the histogram distribution.
  await page.getByRole('button', { name: '응답 시간', exact: true }).click();
  await expect(page).toHaveURL(/metric=http\.server\.request\.duration/);
  await expect(page.getByText('선택한 시리즈의 기간 분포', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'JVM 메모리 사용량', exact: true })).toHaveCount(0);

  await page.goBack();
  for (const name of panels) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
});

test('a failed first load of the apps recovers through retry instead of leaving an empty tab', async ({ page }) => {
  const state = await metricsFixture(page);
  state.failures.add('/observed-services');
  await page.goto(`${API_URL}servers/server-1/metrics`);
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('메트릭 앱 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(panel.getByText('이 서버의 메트릭을 연결하세요', { exact: true })).toHaveCount(0);
  state.failures.clear();
  await panel.getByRole('button', { name: '다시 시도', exact: true }).click();
  await panel.getByRole('table', { name: '메트릭 앱' }).getByRole('link', { name: 'billing-api' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'billing-api', exact: true })).toBeVisible();
  await expect(page.getByRole('tabpanel').locator('.recharts-wrapper')).toHaveCount(2);
});

test('metric names, chart and optional groups have independent HTTP failure states', async ({ page }) => {
  const state = await metricsFixture(page);
  // 그룹 목록은 서버 머리말의 보조 정보다. 실패해도 메트릭은 그대로 조사한다.
  state.failures.add('/projects');
  state.failures.add('/observed-services/metrics-service/otel-metrics/health');
  state.failures.add('points:jvm.memory.used');
  await page.goto(`${API_URL}servers/server-1/metrics/metrics-service`);
  const namesError = page.getByRole('heading', { name: '메트릭 목록을 불러오지 못했습니다' });
  await expect(namesError).toBeVisible();
  await expect(page.getByText('수신한 메트릭이 없습니다', { exact: false })).toHaveCount(0);
  state.failures.delete('/observed-services/metrics-service/otel-metrics/health');
  await namesError.locator('..').getByRole('button', { name: '다시 시도' }).click();
  const memory = page.locator('section').filter({ has: page.getByRole('heading', { name: 'JVM 메모리 사용량', exact: true }) }).last();
  await expect(memory.getByText('메트릭을 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(memory.getByText('이 기간에 데이터 없음', { exact: true })).toHaveCount(0);
  state.failures.delete('points:jvm.memory.used');
  await memory.getByRole('button', { name: '다시 시도' }).click();
  await expect(memory.locator('.recharts-wrapper')).toBeVisible();
});

test('refresh keeps existing charts visible while names are loading', async ({ page }) => {
  const state = await metricsFixture(page);
  await page.goto(`${API_URL}servers/server-1/metrics/metrics-service`);
  await expect(page.locator('.recharts-wrapper')).toHaveCount(2);
  const initialReads = state.requests.filter(path => path === '/observed-services/metrics-service/otel-metrics/health').length;
  let release = () => {};
  state.holdNames = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect.poll(() => state.requests.filter(path => path === '/observed-services/metrics-service/otel-metrics/health').length).toBeGreaterThan(initialReads);
    await expect(page.locator('.recharts-wrapper')).toHaveCount(2);
  } finally {
    release();
    state.holdNames = null;
  }
});

test('histogram distribution failure is explicit and retries without hiding the chart', async ({ page }) => {
  const state = await metricsFixture(page);
  state.failures.add('/observed-services/metrics-service/otel-metrics/quantiles');
  await page.goto(`${API_URL}servers/server-1/metrics/metrics-service?metric=http.server.request.duration`);
  await expect(page.getByText('선택한 시리즈의 기간 분포를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(page.locator('.recharts-wrapper')).toBeVisible();
  state.failures.clear();
  await page.getByRole('button', { name: '분포 다시 시도' }).click();
  await expect(page.getByText('선택한 시리즈의 기간 분포', { exact: true })).toBeVisible();
  await expect(page.getByText('선택한 시리즈의 기간 분포를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
});

// 데모: payments-api 서버에는 메트릭 앱이 없다(SCENARIOS.md).
test('metrics connection creates setup instructions and waits for actual metric receipt', async ({ page }) => {
  await page.goto('./servers/server_mock_payments_api/metrics');
  await page.getByRole('button', { name: '메트릭 연결', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('앱 이름').fill('new-metrics-service');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.locator('pre')).toContainText('OTEL_SERVICE_NAME=new-metrics-service');
  await expect(dialog.locator('pre')).toContainText('OTEL_TRACES_EXPORTER=none');
  await expect(dialog.locator('pre')).toContainText('OTEL_LOGS_EXPORTER=none');
  await expect(dialog.locator('pre')).not.toContainText('OTEL_METRICS_EXPORTER=none');
  await expect(dialog.getByRole('region', { name: '데이터 수신 확인' })).toContainText('수신 대기');
  await dialog.getByRole('button', { name: '메트릭 보기', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/apps\/[^/?]+\?tab=metrics$/);
  await expect(page.getByRole('heading', { level: 1, name: 'new-metrics-service' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '메트릭 수신 대기', exact: true })).toBeVisible();
});
