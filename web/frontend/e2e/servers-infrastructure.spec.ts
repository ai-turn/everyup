import { expect, test, type Page } from '@playwright/test';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크) 이동한다.
const EDGE = 'server_mock_edge_host_01';
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel');

test('a server with infrastructure shows usage trends and connection info without a group picker', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/infrastructure`);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'edge-host-01' })).toBeVisible();
  const memory = panel(page).locator('section', { has: page.getByRole('heading', { name: '메모리', exact: true }) });
  await expect(memory.getByRole('group', { name: /메모리 추이/ })).toBeVisible();
  await expect(panel(page).getByText('API Key', { exact: true })).toBeVisible();
  await expect(panel(page).getByText('OpenTelemetry Collector', { exact: true })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: '연결 중지' })).toBeVisible();
  // 그룹은 서버가 정한다.
  await expect(panel(page).getByRole('combobox', { name: '그룹 배정' })).toHaveCount(0);
  await expect(panel(page).getByText('그룹', { exact: true })).toHaveCount(0);
  // 서버 이름이 유일한 h1이고, 새로고침은 머리말에만 있다.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(panel(page).getByRole('button', { name: '새로고침' })).toHaveCount(0);
});

test('an address with a target id goes to the first screen of the tab', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/infrastructure/infra_mock_edge_01`);
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/infrastructure$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'edge-host-01' })).toBeVisible();
});

test('connecting infrastructure to an empty server shows the setup once and then the detail', async ({ page }) => {
  await page.goto(`./servers/${EMPTY}/infrastructure`);
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 인프라를 연결하세요' })).toBeVisible();
  await panel(page).getByRole('button', { name: '인프라 연결' }).click();
  const dialog = page.getByRole('dialog', { name: 'OpenTelemetry Collector 연결' });
  // 그룹은 서버의 것을 쓴다.
  await expect(dialog.getByRole('combobox', { name: '그룹' })).toHaveCount(0);
  await dialog.getByLabel('인프라 이름').fill('staging-empty-host');
  await dialog.getByRole('button', { name: '추가' }).click();

  await expect(dialog.getByText('Collector 연결이 준비되었습니다')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'API Key 복사' })).toBeVisible();
  // 서버 데이터를 다시 불러와 본문이 바뀌어도 한 번만 볼 수 있는 안내는 닫히지 않는다.
  // 대화 상자가 모달이라 새로고침을 누를 수 없다. 자동 갱신이 다시 보일 때 한 번 도는 것을 이용한다.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'staging-empty-host' })).toBeAttached();
  await expect(dialog.getByText('Collector 연결이 준비되었습니다')).toBeVisible();

  await dialog.getByRole('button', { name: '인프라 보기' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/infrastructure$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'staging-empty-host' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Collector 수신 대기' })).toBeVisible();
  await expect(page.getByText('인프라 리소스를 추가했습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();
});

test('moving infrastructure skips servers that have one and opens it on the new server', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/infrastructure`);
  await panel(page).getByRole('button', { name: '다른 서버로 옮기기' }).click();
  const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
  await expect(dialog.getByRole('radio', { name: /^db-primary-01/ })).toBeDisabled();
  await expect(dialog.getByRole('radio', { name: /^batch-host-01/ })).toBeDisabled();
  await expect(dialog.getByRole('radio', { name: /^edge-host-01/ })).toHaveCount(0);
  await dialog.getByRole('radio', { name: 'payments-api (Production)' }).check();
  await dialog.getByRole('button', { name: '옮기기' }).click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/infrastructure$/);
  await expect(page.getByRole('heading', { level: 1, name: 'payments-api' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { level: 2, name: 'edge-host-01' })).toBeVisible();
  await expect(page.getByText('인프라 리소스를 옮겼습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/infrastructure$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 인프라를 연결하세요' })).toBeVisible();
});

test('deleting infrastructure returns the tab to the connect prompt', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/infrastructure`);
  await panel(page).getByRole('button', { name: '삭제' }).click();
  await page.getByRole('dialog', { name: '인프라 리소스를 삭제할까요?' }).getByRole('button', { name: '삭제' }).click();
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 인프라를 연결하세요' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/infrastructure$`));
  await expect(panel(page)).toBeFocused();
});

test('the infrastructure tab has no horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`./servers/${EDGE}/infrastructure`);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'edge-host-01' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});
