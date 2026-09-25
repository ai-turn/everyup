import { expect, test } from '@playwright/test';
import { metricDisplayUnit, niceTicks } from '../src/components/charts/chartTheme';

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
  await page.goto('./metrics');
  // The API returns one row per (service, metric); the demo api service exports two.
  await expect(page.getByRole('heading', { level: 3, name: 'api', exact: true })).toHaveCount(1);
  await expect(page.getByText('메트릭 2개')).toBeVisible();

  await page.getByRole('heading', { level: 3, name: 'catalog-worker', exact: true }).click();
  const panels = ['http.server.active_requests', 'http.server.request.duration', 'jvm.memory.used'];
  for (const name of panels) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('gauge · MB', { exact: true })).toBeVisible();
  await expect(page.getByText('histogram · 구간 평균 · ms', { exact: true })).toBeVisible();

  // A panel's title opens that metric alone, with the histogram distribution.
  await page.getByRole('button', { name: 'http.server.request.duration', exact: true }).click();
  await expect(page).toHaveURL(/metric=http\.server\.request\.duration/);
  await expect(page.getByText('전체 기간 분포', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'jvm.memory.used', exact: true })).toHaveCount(0);

  await page.goBack();
  for (const name of panels) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
});
