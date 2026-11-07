import { expect, test, type Locator } from '@playwright/test';
import { mockRouter } from '../src/services/mockRouter';
import type { ApiRequest, LogEntry, ServiceHistoryPoint, TraceDetail } from '../src/services/api';

const payment = './services/agent_demo_01/shop%3Apayment-worker';
const endpoint = '/agents/agent_demo_01/services/shop%3Apayment-worker';

test('the ongoing demo outage has failed checks and linked HTTP evidence', () => {
  const points = mockRouter<ServiceHistoryPoint[]>(`${endpoint}/history?range=6h`);
  expect(points.some(point => Date.parse(point.time) >= Date.now() - 6 * 3_600_000 && point.uptimePct < 100)).toBe(true);
  const rows = mockRouter<{ data: ApiRequest[] }>(`${endpoint}/requests?limit=100`).data;
  const request = rows.find(row => row.path === '/api/v1/payments');
  expect(request).toBeDefined();
  expect(request!.isError).toBe(true);
  const trace = mockRouter<TraceDetail>(`/traces/${request!.traceId}`);
  expect(trace.apiRequests.some(row => row.id === request!.id)).toBe(true);
});

test('the first traced timeout log links to a failed operation', () => {
  const rows = mockRouter<{ data: LogEntry[] }>(`${endpoint}/logs?limit=100`).data;
  const error = rows.find(log => log.level === 'error' && log.traceId)!;
  const trace = mockRouter<TraceDetail>(`/traces/${error.traceId}`);
  expect(trace.spans.some(span => span.statusCode === 'ERROR')).toBe(true);
  expect(trace.logs.some(log => log.id === error.id)).toBe(true);
});

for (const scenario of ['정상 운영', '확인 필요']) {
  test(`${scenario} demo collection preserves its intended status after three minutes`, async ({ page }) => {
    await page.clock.install();
    await page.goto('./');
    await page.getByRole('combobox', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: scenario, exact: true }).click();
    const status = scenario === '정상 운영' ? page.getByText('현재 확인이 필요한 이상이 없습니다') : page.getByLabel('확인 필요 1건', { exact: true });
    await expect(status).toBeVisible();
    await page.clock.fastForward(180_000);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(status).toBeVisible();
    await page.getByRole('link', { name: 'Docker 환경', exact: true }).click();
    await page.getByRole('link', { name: /^개요/ }).click();
    await expect(status).toBeVisible();
  });
}

test('first-start creation stays visible and identifies the simulated installation', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('combobox', { name: '데모 시나리오' }).click();
  await page.getByRole('option', { name: '첫 시작', exact: true }).click();
  await page.locator('section').filter({ hasText: '아직 모니터링 대상이 없습니다' })
    .getByRole('link', { name: 'Docker 연결', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Docker 환경 이름').fill('first-visit-example');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByText(/예시 설치 화면입니다/)).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: '실제 설치 방법 보기' })).toHaveAttribute('href', /guide\/quickstart/);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'first-visit-example' })).toContainText('설치 대기');
});

for (const key of ['Enter', 'Space']) {
  test(`a nested trace button opens with ${key} and restores focus`, async ({ page }) => {
    await page.goto(`${payment}?tab=logs`);
    const trace = page.getByRole('button', { name: '트레이스', exact: true }).first();
    await trace.focus();
    await trace.press(key);
    const dialog = page.getByRole('dialog', { name: '트레이스 상세' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trace).toBeFocused();
  });
}

test('mobile service details expose data and retain a 44px time-range target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${payment}?tab=uptime`);
  const disclosure = page.locator('details').filter({ has: page.locator('summary', { hasText: '서비스 정보' }) });
  await expect(disclosure).not.toHaveAttribute('open', '');
  const overview = page.getByText('24시간 업타임', { exact: true });
  await expect(overview).toBeVisible();
  const box = await overview.boundingBox();
  const navigation = await page.getByRole('link', { name: '더보기', exact: true }).boundingBox();
  expect(box!.y + box!.height).toBeLessThan(navigation!.y);
  for (const button of await page.getByRole('group', { name: '시간 범위', exact: true }).getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await disclosure.locator('summary').click();
  await expect(disclosure.getByText('ghcr.io/shop/payment-worker:1.8.3', { exact: true })).toBeVisible();
});

async function contrast(locator: Locator, border = false) {
  return locator.evaluate((element, useBorder) => {
    const rgba = (color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const nodes: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) nodes.unshift(node);
    let background = [255, 255, 255];
    for (const node of nodes) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      background = background.map((value, i) => value * (1 - color[3] / 255) + color[i] * color[3] / 255);
    }
    const foreground = rgba(useBorder ? getComputedStyle(element).borderTopColor : getComputedStyle(element).color);
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const a = luminance(background), b = luminance(foreground);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, border);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme} demo and form colors preserve legibility`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    const badge = page.getByText('Live Demo', { exact: true }).filter({ visible: true });
    expect(await contrast(badge)).toBeGreaterThanOrEqual(4.5);
    await expect(page.getByRole('link', { name: '실제 사용 시작하기', exact: true })).toHaveAttribute('href', /guide\/quickstart/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./alerts/channels/new');
    const label = page.locator('p').filter({ hasText: /^Telegram$/ });
    expect(await contrast(label)).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page.getByLabel('표시 이름', { exact: false }), true)).toBeGreaterThanOrEqual(3);
  });
}
