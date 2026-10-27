import { expect, test } from '@playwright/test';
import { deferred, dockerService, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });
const source = '/agents/docker-host/services/shop%3Aapi';
const url = './services/docker-host/shop%3Aapi';

async function seed(page: import('@playwright/test').Page) {
  const state = await uptimeFixture(page);
  state.responses.set(`GET ${source}/history`, [
    { time: new Date(Date.now() - 120_000).toISOString(), latencyMs: 100, uptimePct: 100, total: 9 },
    { time: new Date(Date.now() - 60_000).toISOString(), latencyMs: 0, uptimePct: 0, total: 1 },
  ]);
  state.responses.set(`GET ${source}/uptime`, [{ date: new Date().toLocaleDateString('sv-SE'), uptimePct: 90, healthyChecks: 9, totalChecks: 10 }]);
  return state;
}

test('[12] Docker snapshot loading, errors, stale refresh and missing keys are distinct', async ({ page }) => {
  const state = await seed(page);
  state.failures.set('GET /agents/services/all', 500);
  const gate = deferred(); state.holds.set('GET /agents/services/all', gate.promise);
  try {
    await page.goto(url);
    await expect(page.getByText('로딩 중…', { exact: true })).toBeVisible();
    gate.resolve(); state.holds.clear();
    await expect(page.getByText('서비스를 불러오지 못했습니다', { exact: true })).toBeVisible();
    state.failures.clear();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Docker API', exact: true })).toBeVisible();
    state.failures.set('GET /agents/services/all', 500);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('이전에 불러온');
    await expect(page.getByRole('heading', { name: 'Docker API', exact: true })).toBeVisible();
    state.failures.clear();
    await page.goto('./services/docker-host/missing');
    await expect(page.getByText('서비스를 찾을 수 없습니다', { exact: true })).toBeVisible();
  } finally { gate.resolve(); }
});

for (const [path, label] of [['/history', '체크 이력'], ['/uptime', '90일 이력'], ['/events', '알림 기록']]) {
  test(`[12] Docker ${label} errors are visible and recoverable without losing known data`, async ({ page }) => {
    const state = await seed(page);
    state.failures.set(`GET ${source}${path}`, 500);
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Docker API', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: label }).first()).toBeVisible();
    await expect(page.getByText('장애 기록이 없습니다', { exact: true })).toHaveCount(0);
    state.failures.clear();
    const alerts = page.getByRole('alert').filter({ hasText: label });
    const alertCount = await alerts.count();
    await page.getByRole('button', { name: '다시 시도', exact: true }).first().click();
    await expect(alerts).toHaveCount(alertCount - 1);
    if (alertCount > 1) await alerts.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(alerts).toHaveCount(0);
    await expect(page.getByText('90.00%', { exact: true }).first()).toBeVisible();
    state.failures.set(`GET ${source}${path}`, 500);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: label }).first()).toContainText('이전');
    await expect(page.getByRole('heading', { name: 'Docker API', exact: true })).toBeVisible();
  });
}

for (const [changes, label] of [[{ seen: false, observedAt: '' }, '확인 대기'], [{ silenced: true }, '일시정지'], [{ observedAt: new Date(Date.now() - 3_600_000).toISOString() }, '수집 지연'] ] as const) {
  test(`[12] Docker ${label} is not reported as healthy`, async ({ page }) => {
    const state = await seed(page); state.services = [dockerService(changes)];
    await page.goto(url);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText('정상', { exact: true })).toHaveCount(0);
  });
}

test('[12] Docker uptime uses check-weighted totals and no-data is not zero incidents', async ({ page }) => {
  const state = await seed(page);
  await page.goto(url);
  const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: '업타임 현황', exact: true }) });
  await expect(overview.locator('dl > div').filter({ hasText: '24시간 업타임' }).locator('dd')).toHaveText('90.00%');
  state.responses.set(`GET ${source}/history`, []); state.responses.set(`GET ${source}/uptime`, []);
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(overview.locator('dl > div').filter({ hasText: '90일 장애' }).locator('dd')).toHaveText('-');
  await expect(page.getByText('알림 기록이 없습니다', { exact: true })).toBeVisible();
});

test('[12] Docker data sources show loading until their own requests complete', async ({ page }) => {
  const state = await seed(page); const gate = deferred();
  for (const path of ['/history', '/uptime', '/events']) state.holds.set(`GET ${source}${path}`, gate.promise);
  try {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Docker API', exact: true })).toBeVisible();
    const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: '업타임 현황', exact: true }) });
    await expect(overview.locator('dd')).toHaveText(['-', '-', '-', '-']);
    await expect(page.getByText('알림 기록이 없습니다', { exact: true })).toHaveCount(0);
    gate.resolve();
    await expect(overview.locator('dd').first()).toHaveText('90.00%');
    await expect(page.getByText('알림 기록이 없습니다', { exact: true })).toBeVisible();
  } finally { gate.resolve(); }
});

test('[12] daily totals are weighted and only alert/recovery events appear in the alert record', async ({ page }) => {
  const state = await seed(page);
  state.responses.set(`GET ${source}/uptime`, [
    { date: new Date().toLocaleDateString('sv-SE'), uptimePct: 90, healthyChecks: 9, totalChecks: 10 },
    { date: new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE'), uptimePct: 100, healthyChecks: 90, totalChecks: 90 },
  ]);
  state.responses.set(`GET ${source}/events`, ['alert_sent', 'recovery_sent', 'container_started'].map((type, id) => ({ id, agentId: 'docker-host', type, time: new Date().toISOString(), createdAt: new Date().toISOString(), message: type })));
  await page.goto(url);
  const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: '업타임 현황', exact: true }) });
  await expect(overview.locator('dl > div').filter({ hasText: '90일 업타임' }).locator('dd')).toHaveText('99.00%');
  await expect(page.getByText('alert_sent', { exact: true })).toBeVisible();
  await expect(page.getByText('recovery_sent', { exact: true })).toBeVisible();
  await expect(page.getByText('container_started', { exact: true })).toHaveCount(0);
});
