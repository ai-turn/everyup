import { expect, test } from '@playwright/test';
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

test('metric list shows one card per service and the detail shows every metric at once', async ({ page }) => {
  await page.goto('./metrics?view=card');
  // The retained catalog includes every metric; catalog-worker exports three.
  await expect(page.getByRole('heading', { level: 3, name: 'catalog-worker', exact: true })).toHaveCount(1);
  await expect(page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'catalog-worker', exact: true }) }).getByText('메트릭 3개')).toBeVisible();
  // Docker Collector metrics stay in their Docker Environment (ADR 0007).
  await expect(page.getByRole('heading', { level: 3, name: 'api', exact: true })).toHaveCount(0);

  await page.getByRole('heading', { level: 3, name: 'catalog-worker', exact: true }).click();
  const panels = ['http.server.active_requests', 'http.server.request.duration', 'jvm.memory.used'];
  for (const name of panels) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('gauge, MB', { exact: true })).toBeVisible();
  await expect(page.getByText('histogram, 수신 평균, ms', { exact: true })).toBeVisible();

  // A panel's title opens that metric alone, with the histogram distribution.
  await page.getByRole('button', { name: 'http.server.request.duration', exact: true }).click();
  await expect(page).toHaveURL(/metric=http\.server\.request\.duration/);
  await expect(page.getByText('선택한 시리즈의 기간 분포', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'jvm.memory.used', exact: true })).toHaveCount(0);

  await page.goBack();
  for (const name of panels) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
});

test('catalog search keeps the full count, matches metric names and persists in the URL', async ({ page }) => {
  await metricsFixture(page);
  await page.goto('http://127.0.0.1:4174/metrics?view=card');
  await expect(page.getByText('메트릭 2개', { exact: true })).toBeVisible();
  await expect(page.getByText('메트릭 0개', { exact: true })).toBeVisible();
  // The catalog's receipt is independent of the service's all-signal lastSeenAt.
  await expect(page.locator('time').first()).toHaveAttribute('datetime', /T/);
  const search = page.getByRole('textbox', { name: '서비스 또는 메트릭 이름으로 찾기' });
  await search.fill('JVM');
  await expect(page).toHaveURL(/q=JVM/);
  await expect(page.getByRole('heading', { name: 'waiting-worker', exact: true })).toHaveCount(0);
  await expect(page.getByText('메트릭 2개', { exact: true })).toBeVisible();
  await page.reload();
  await expect(search).toHaveValue('JVM');
  await search.fill('no-matching-metric');
  await expect(page.getByRole('heading', { name: '일치하는 서비스가 없습니다' })).toBeVisible();
  await page.getByRole('button', { name: '검색 초기화' }).click();
  await expect(page.getByRole('heading', { name: 'waiting-worker', exact: true })).toBeVisible();
});

test('catalog HTTP failure recovers through retry instead of leaving an empty list', async ({ page }) => {
  const state = await metricsFixture(page);
  state.failures.add('/observed-services/metric-catalog');
  await page.goto('http://127.0.0.1:4174/metrics?view=card');
  await expect(page.getByRole('heading', { name: '메트릭을 불러오지 못했습니다' })).toBeVisible();
  state.failures.clear();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'billing-api', exact: true })).toBeVisible();
  await expect(page.getByText('메트릭 2개', { exact: true })).toBeVisible();
});

test('metric names, chart and optional groups have independent HTTP failure states', async ({ page }) => {
  const state = await metricsFixture(page);
  state.failures.add('/projects');
  state.failures.add('/observed-services/metrics-service/otel-metrics');
  state.failures.add('points:jvm.memory.used');
  await page.goto('http://127.0.0.1:4174/metrics/metrics-service');
  await expect(page.getByText('그룹 목록을 불러오지 못했습니다', { exact: true })).toBeVisible();
  const namesError = page.getByRole('heading', { name: '메트릭 목록을 불러오지 못했습니다' });
  await expect(namesError).toBeVisible();
  await expect(page.getByText('수신한 메트릭이 없습니다.', { exact: false })).toHaveCount(0);
  state.failures.delete('/observed-services/metrics-service/otel-metrics');
  await namesError.locator('..').getByRole('button', { name: '다시 시도' }).click();
  const memory = page.locator('section').filter({ has: page.getByRole('heading', { name: 'jvm.memory.used', exact: true }) });
  await expect(memory.getByText('메트릭을 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(memory.getByText('이 기간에 데이터 없음', { exact: true })).toHaveCount(0);
  state.failures.delete('points:jvm.memory.used');
  await memory.getByRole('button', { name: '다시 시도' }).click();
  await expect(memory.locator('.recharts-wrapper')).toBeVisible();
  state.failures.delete('/projects');
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '그룹 배정' })).toBeVisible();
});

test('refresh keeps existing charts visible while names are loading', async ({ page }) => {
  const state = await metricsFixture(page);
  await page.goto('http://127.0.0.1:4174/metrics/metrics-service');
  await expect(page.locator('.recharts-wrapper')).toHaveCount(2);
  const initialReads = state.requests.filter(path => path === '/observed-services/metrics-service/otel-metrics').length;
  let release = () => {};
  state.holdNames = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect.poll(() => state.requests.filter(path => path === '/observed-services/metrics-service/otel-metrics').length).toBeGreaterThan(initialReads);
    await expect(page.locator('.recharts-wrapper')).toHaveCount(2);
  } finally {
    release();
    state.holdNames = null;
  }
});

test('histogram distribution failure is explicit and retries without hiding the chart', async ({ page }) => {
  const state = await metricsFixture(page);
  state.failures.add('/observed-services/metrics-service/otel-metrics/quantiles');
  await page.goto('http://127.0.0.1:4174/metrics/metrics-service?metric=http.server.request.duration');
  await expect(page.getByText('선택한 시리즈의 기간 분포를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(page.locator('.recharts-wrapper')).toBeVisible();
  state.failures.clear();
  await page.getByRole('button', { name: '분포 다시 시도' }).click();
  await expect(page.getByText('선택한 시리즈의 기간 분포', { exact: true })).toBeVisible();
  await expect(page.getByText('선택한 시리즈의 기간 분포를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
});

test('metrics connection creates setup instructions and waits for actual metric receipt', async ({ page }) => {
  await page.goto('./metrics');
  await page.getByRole('button', { name: '메트릭 연결', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('서비스 이름').fill('new-metrics-service');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.locator('pre')).toContainText('OTEL_SERVICE_NAME=new-metrics-service');
  await expect(dialog.locator('pre')).toContainText('OTEL_TRACES_EXPORTER=none');
  await expect(dialog.locator('pre')).toContainText('OTEL_LOGS_EXPORTER=none');
  await expect(dialog.locator('pre')).not.toContainText('OTEL_METRICS_EXPORTER=none');
  await expect(dialog.getByRole('region', { name: '데이터 수신 확인' })).toContainText('수신 대기');
  await dialog.getByRole('button', { name: '메트릭 보기', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'new-metrics-service' })).toBeVisible();
  await expect(page.getByText('수신한 메트릭이 없습니다.', { exact: false })).toBeVisible();
});
