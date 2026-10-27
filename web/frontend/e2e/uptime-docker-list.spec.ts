import { expect, test } from '@playwright/test';
import { dockerService, monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('[01 audit] Docker environment states paused, unseen and delayed snapshots apart', async ({ page }) => {
  const state = await uptimeFixture(page); state.monitors = [];
  state.services = [
    dockerService({ key: 'fresh-up', name: 'Fresh up' }),
    dockerService({ key: 'fresh-down', name: 'Fresh down', healthy: false }),
    dockerService({ key: 'paused', name: 'Paused Docker', silenced: true }),
    dockerService({ key: 'waiting', name: 'Waiting Docker', seen: false, observedAt: '' }),
    dockerService({ key: 'delayed', name: 'Delayed Docker', observedAt: new Date(Date.now() - 3_600_000).toISOString() }),
  ];
  // The setup panel reads a status object; the fixture answers unknown paths with [].
  state.responses.set('GET /agents/docker-host/setup-status', { connected: true, configApplied: true, profile: { kind: 'basic', capabilities: ['uptime'] }, signals: [] });
  // Docker Collector checks live in their Docker Environment, not on Uptime (ADR 0007).
  await page.goto('./agents/docker-host');
  const table = page.getByRole('table', { name: 'Docker 서비스 그리드' });
  for (const [name, label] of [['Fresh up', '정상'], ['Fresh down', '장애'], ['Paused Docker', '일시정지'], ['Waiting Docker', '확인 대기'], ['Delayed Docker', '수집 지연']]) {
    const row = table.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });
    await expect(row.getByText(label, { exact: true })).toBeVisible();
  }
});

test('Uptime lists independent monitors only (ADR 0007)', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.services = [dockerService(), dockerService({ key: 'worker', name: 'Liveness worker', checkType: 'docker', endpoint: '' })];
  await page.goto('./uptime');
  const rows = page.getByRole('table', { name: '업타임 그리드' }).getByRole('row');

  await expect(rows.filter({ hasText: 'Public API' })).toContainText('HTTP · 30초');
  await expect(page.getByRole('link', { name: 'Docker API', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Liveness worker', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '업타임 상태 요약' }).locator('dd')).toHaveText(['2', '0', '0', '0']);
  await expect(page.getByRole('combobox', { name: '검사 출처' })).toHaveCount(0);
});

test('empty Uptime points Docker users to their Docker environment', async ({ page }) => {
  const state = await uptimeFixture(page); state.monitors = [];
  await page.goto('./uptime');
  await expect(page.getByRole('heading', { name: '표시할 업타임 대상이 없습니다' })).toBeVisible();
  await page.getByRole('link', { name: 'Docker 환경', exact: true }).last().click();
  await expect(page).toHaveURL(/\/environments$/);
});

test('Uptime list shows 24h uptime and average response, and 0% is not "no data"', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors = [
    monitor('http-monitor', { uptime: 99.5, responseTime: 1200, latencyHistory: [1100, 1200, 1300] }),
    monitor('down-monitor', { name: 'Down API', status: 'unhealthy', uptime: 0 }),
  ];
  await page.goto('./uptime');
  const rows = page.getByRole('table', { name: '업타임 그리드' }).getByRole('row');
  await expect(rows.filter({ hasText: 'Public API' })).toContainText('99.50%');
  await expect(rows.filter({ hasText: 'Public API' })).toContainText('1,200ms');
  await expect(rows.filter({ hasText: 'Down API' })).toContainText('0.00%');
});
