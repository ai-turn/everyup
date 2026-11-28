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
  await expect(page.getByRole('heading', { level: 1, name: '서버 13' })).toBeAttached();
  const first = dataRows(page).first();
  await expect(first.getByRole('link', { name: 'edge-host-01', exact: true })).toBeVisible();
  await expect(first.getByRole('cell').nth(1)).toContainText('장애');
  await expect(first.getByRole('cell').nth(1)).toContainText('응답 없음');

  // 사용률이 경고 기준을 넘은 서버는 확인 필요이고 원인에 그 항목이 보인다.
  await expect(rowOf(page, 'db-primary-01').getByRole('cell').nth(1)).toContainText('확인 필요');
  await expect(rowOf(page, 'db-primary-01').getByRole('cell').nth(1)).toContainText('메모리 84.6%');

  // 대상이 없는 서버는 대기이고, 수치는 0이 아니라 `연결 전`이다(G안 점선 상자). 보이는 열만 센다 — 이 폭에서는 업타임 열이 접힌다.
  const empty = rowOf(page, 'staging-empty');
  await expect(empty.getByRole('cell').nth(1)).toContainText('대기');
  await expect(empty.getByText('연결 전', { exact: true }).filter({ visible: true })).toHaveCount(4);
  await expect(empty.getByRole('cell').nth(2)).toHaveText('연결 전');

  // 원인은 한 줄이다. 행을 채우지 않는다(G안: 상태는 앞의 모양과 단어가 말한다). 그룹은 없다(ADR 0013).
  await expect(first.getByRole('cell').first()).not.toContainText('Production');
  const cause = first.getByRole('cell').nth(1).locator('p');
  expect(await cause.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('nowrap');
  const tint = (row: ReturnType<typeof rowOf>) => row.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(await tint(first)).toBe('rgba(0, 0, 0, 0)');
  expect(await tint(rowOf(page, 'db-primary-01'))).toBe('rgba(0, 0, 0, 0)');
});

test('search finds servers by their targets and keeps the query in the address', async ({ page }) => {
  await page.goto('./servers');
  await expect(dataRows(page).first()).toBeVisible();
  // 모니터 Orders PostgreSQL의 주소에만 있는 값이다. 같은 서버의 앱 이름에는 없다.
  await page.getByRole('textbox', { name: '서버 또는 대상 검색' }).fill('orders-db');
  await expect(dataRows(page)).toHaveCount(1);
  await expect(dataRows(page).first()).toContainText('batch-host-01');
  await expect(dataRows(page).first()).toContainText('Orders PostgreSQL');
  await expect(page).toHaveURL(/[?&]q=orders-db/);

  await page.getByRole('textbox', { name: '서버 또는 대상 검색' }).fill('no-such-target');
  await expect(page.getByText('검색 결과가 없습니다')).toBeVisible();
  await page.getByRole('button', { name: '필터 해제', exact: true }).click();
  await expect(dataRows(page)).toHaveCount(13);
});

test('the search box follows the address when it changes from outside', async ({ page }) => {
  await page.goto('./servers?q=orders-db');
  const search = page.getByRole('textbox', { name: '서버 또는 대상 검색' });
  await expect(search).toHaveValue('orders-db');
  await expect(dataRows(page)).toHaveCount(1);
  // 같은 화면에서 q가 없는 주소로 이동한다(뒤로 가기·링크와 같은 경로).
  await page.evaluate(() => {
    window.history.pushState(null, '', window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(search).toHaveValue('');
  await expect(dataRows(page)).toHaveCount(13);
});

// 그룹은 없어졌다(ADR 0013). 옛 그룹 필터 주소는 서버를 숨기지 않는다.
test('an old group filter in the address does not hide servers', async ({ page }) => {
  await page.goto('./servers?group=project_mock_backoffice');
  await expect(page.getByRole('combobox', { name: /그룹/ })).toHaveCount(0);
  await expect(dataRows(page)).toHaveCount(13);
});

test('status summary and connection filter narrow the list', async ({ page }) => {
  await page.goto('./servers');
  const chips = page.getByRole('group', { name: '상태로 거르기' });
  const down = chips.getByRole('button', { name: /장애/ });
  // 칩은 키보드로도 고른다.
  await down.focus();
  await page.keyboard.press('Enter');
  await expect(down).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(down).toHaveAttribute('aria-pressed', 'false');
  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/[?&]status=error/);
  // 직접 연결한 서버와 Docker 서버(컨테이너 장애)가 함께 나온다.
  await expect(dataRows(page)).toHaveCount(2);
  await expect(dataRows(page).first()).toContainText('edge-host-01');
  await expect(rowOf(page, 'prod-server')).toContainText('payment-worker');
  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'false');
  await expect(page).not.toHaveURL(/status=/);
  await expect(dataRows(page)).toHaveCount(13);

  await page.getByRole('combobox', { name: '연결 방식으로 거르기' }).click();
  await page.getByRole('option', { name: 'Docker Collector', exact: true }).click();
  await expect(page).toHaveURL(/[?&]connection=docker/);
  await expect(dataRows(page)).toHaveCount(4);
  // 칩의 개수는 연결 방식과 검색을 따른다(상태 선택은 따르지 않는다).
  await expect(chips.getByRole('button', { name: /장애/ })).toHaveText(/장애\s*1$/);
  await expect(chips.getByRole('button', { name: /확인 필요/ })).toHaveText(/확인 필요\s*1$/);
  await expect(chips.getByRole('button', { name: /정상/ })).toHaveText(/정상\s*1$/);
});

test('server name opens the server address', async ({ page }) => {
  await page.goto('./servers');
  await page.getByRole('link', { name: 'payments-api', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api$/);
});

// Docker 환경은 같은 ID의 서버다(ADR 0012). Docker Collector의 호스트 지표는 그 서버의 인프라다.
test('Docker host metrics belong to the Docker server', async ({ page }) => {
  const docker = mockRouter<InfrastructureResource[]>('/infrastructure-resources').filter(row => row.adapter === 'everyup-agent');
  expect(docker.length).toBeGreaterThan(0);
  for (const resource of docker) expect(resource.serverId).toBe(resource.id);
  await page.goto('./servers');
  await expect(rowOf(page, 'worker-cluster').getByRole('cell').nth(2)).toHaveText(/^\d+(\.\d)?%/);
});

test('the connection filter splits Docker servers from directly connected ones', async ({ page }) => {
  await page.goto('./servers');
  const connection = page.getByRole('combobox', { name: '연결 방식으로 거르기' });
  await connection.click();
  await page.getByRole('option', { name: 'Docker Collector', exact: true }).click();
  await expect(page).toHaveURL(/[?&]connection=docker/);
  await expect(dataRows(page)).toHaveCount(4);
  await expect(rowOf(page, 'edge-host-01')).toHaveCount(0);
  await connection.click();
  await page.getByRole('option', { name: '직접 연결', exact: true }).click();
  await expect(rowOf(page, 'prod-server')).toHaveCount(0);
  await expect(rowOf(page, 'edge-host-01')).toBeVisible();
  // 대상이 없는 서버는 어느 연결 방식도 아니다.
  await expect(rowOf(page, 'staging-empty')).toHaveCount(0);
  await page.getByRole('textbox', { name: '서버 또는 대상 검색' }).fill('no-such-target');
  await page.getByRole('button', { name: '필터 해제', exact: true }).click();
  await expect(page).not.toHaveURL(/connection=/);
  await expect(dataRows(page)).toHaveCount(13);
});

test('partial failure keeps the rows and says what is missing', async ({ page }) => {
  await page.goto('./servers');
  await chooseScenario(page, '부분 수집 실패');
  await expect(page.getByText('일부 정보를 불러오지 못했습니다')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  await expect(rowOf(page, 'edge-host-01')).toBeVisible();
  await expect(dataRows(page)).toHaveCount(13);
  // 앱 목록이 실패했으므로 앱만 가진 서버의 오류 로그는 알 수 없다.
  // 앱만 가진 inventory-api는 앱 목록이 빠지면 확인할 수 있는 대상이 없어 대기다. 대상이 없다고 단정하지 않고 까닭을 적는다.
  const inventory = rowOf(page, 'inventory-api');
  await expect(inventory.getByRole('cell').nth(1)).toHaveText('대기앱 확인 불가');
  // 조회에 실패한 칸은 빈 칸(해당 없음)이나 `-`(데이터 없음)와 다른 표시다.
  const failedCell = inventory.getByRole('cell').nth(5);
  await expect(failedCell).toHaveText('불러오지 못함');
  await failedCell.locator('[aria-hidden="true"]').first().hover();
  await expect(page.getByRole('tooltip')).toHaveText('불러오지 못함');
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
