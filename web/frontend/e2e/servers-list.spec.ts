import { expect, test, type Page } from '@playwright/test';
import { mockRouter } from '../src/services/mockRouter';
import type { InfrastructureResource } from '../src/services/api';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다.
const table = (page: Page) => page.getByRole('table', { name: '서버 그리드' });
const dataRows = (page: Page) => table(page).locator('tbody tr');
const rowOf = (page: Page, name: string) => dataRows(page).filter({ has: page.getByRole('link', { name, exact: true }) });

async function chooseScenario(page: Page, label: string) {
  await page.getByRole('combobox', { name: '데모 시나리오' }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('server list puts the failing server first with its cause', async ({ page }) => {
  await page.goto('./servers');
  await expect(page.getByRole('heading', { level: 1, name: '서버' })).toBeAttached();
  const first = dataRows(page).first();
  await expect(first.getByRole('link', { name: 'edge-host-01', exact: true })).toBeVisible();
  await expect(first.getByRole('cell').nth(1)).toContainText('장애');
  await expect(first.getByRole('cell').nth(1)).toContainText('응답 없음');

  // 사용률이 경고 기준을 넘은 서버는 확인 필요이고 원인에 그 항목이 보인다.
  await expect(rowOf(page, 'db-primary-01').getByRole('cell').nth(1)).toContainText('확인 필요');
  await expect(rowOf(page, 'db-primary-01').getByRole('cell').nth(1)).toContainText('메모리 84.6%');

  // 대상이 없는 서버는 대기이고, 수치는 0이 아니라 수집 안 함이다.
  const empty = rowOf(page, 'staging-empty');
  await expect(empty.getByRole('cell').nth(1)).toContainText('대기');
  const missing = empty.getByLabel('수집 안 함');
  await expect(missing).toHaveCount(4);
  await expect(missing.first()).toHaveText('-');
  await missing.first().hover();
  await expect(page.getByRole('tooltip')).toHaveText('수집 안 함');
});

test('search finds servers by their targets and keeps the query in the address', async ({ page }) => {
  await page.goto('./servers');
  await expect(dataRows(page).first()).toBeVisible();
  await page.getByRole('textbox', { name: '서버 또는 대상 검색' }).fill('Checkout');
  await expect(dataRows(page)).toHaveCount(1);
  await expect(dataRows(page).first()).toContainText('edge-host-01');
  await expect(dataRows(page).first()).toContainText('Checkout API');
  await expect(page).toHaveURL(/[?&]q=Checkout/);

  await page.getByRole('textbox', { name: '서버 또는 대상 검색' }).fill('no-such-target');
  await expect(page.getByText('검색 결과가 없습니다')).toBeVisible();
  await page.getByRole('button', { name: '필터 해제', exact: true }).click();
  await expect(dataRows(page)).toHaveCount(9);
});

test('status summary and group filter narrow the list', async ({ page }) => {
  await page.goto('./servers');
  const down = page.getByRole('group', { name: '상태로 거르기' }).getByRole('button', { name: /장애/ });
  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/[?&]status=error/);
  await expect(dataRows(page)).toHaveCount(1);
  await expect(dataRows(page).first()).toContainText('edge-host-01');
  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'false');
  await expect(page).not.toHaveURL(/status=/);
  await expect(dataRows(page)).toHaveCount(9);

  await page.getByRole('combobox', { name: '그룹으로 거르기' }).click();
  await page.getByRole('option', { name: 'Backoffice', exact: true }).click();
  await expect(page).toHaveURL(/[?&]group=/);
  await expect(dataRows(page)).toHaveCount(2);
  await expect(rowOf(page, 'batch-host-01')).toBeVisible();
  await expect(rowOf(page, 'Mail relay')).toBeVisible();
});

test('server name opens the server address', async ({ page }) => {
  await page.goto('./servers');
  await page.getByRole('link', { name: 'payments-api', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api$/);
});

test('Docker infrastructure never shows up as a server target', async ({ page }) => {
  const docker = mockRouter<InfrastructureResource[]>('/infrastructure-resources').filter(row => row.adapter === 'everyup-agent');
  expect(docker.length).toBeGreaterThan(0);
  await page.goto('./servers');
  await expect(dataRows(page).first()).toBeVisible();
  for (const resource of docker) await expect(table(page)).not.toContainText(resource.name);
  // 서버에 넣었다면 이름 검색에 걸린다.
  await page.getByRole('textbox', { name: '서버 또는 대상 검색' }).fill(docker[0].name);
  await expect(page.getByText('검색 결과가 없습니다')).toBeVisible();
});

test('partial failure keeps the rows and says what is missing', async ({ page }) => {
  await page.goto('./servers');
  await chooseScenario(page, '부분 수집 실패');
  await expect(page.getByText('일부 정보를 불러오지 못했습니다')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  await expect(rowOf(page, 'edge-host-01')).toBeVisible();
  await expect(dataRows(page)).toHaveCount(9);
  // 앱 목록이 실패했으므로 앱만 가진 서버의 오류 로그는 알 수 없다.
  await expect(rowOf(page, 'inventory-api').getByLabel('불러오지 못함').first()).toHaveText('-');
});

test('empty scenario guides adding a server', async ({ page }) => {
  await page.goto('./servers');
  await chooseScenario(page, '첫 시작');
  const empty = page.getByRole('heading', { name: '아직 서버가 없습니다' });
  await expect(empty).toBeVisible();
  await expect(empty.locator('..').getByRole('link', { name: '서버 추가', exact: true })).toHaveAttribute('href', /\/servers\/new$/);
});

test('narrow screens do not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('./servers');
  await expect(dataRows(page).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
