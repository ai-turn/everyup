import { expect, test, type Page } from '@playwright/test';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크) 이동한다.
const serverHeader = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
const serverRows = (page: Page) => page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');
const serverLink = (page: Page, name: string) => serverRows(page).getByRole('link', { name, exact: true });

async function openSettings(page: Page) {
  await serverHeader(page).getByRole('button', { name: '서버 설정' }).click();
  return page.getByRole('dialog', { name: '서버 설정' });
}

async function choose(page: Page, scope: ReturnType<Page['getByRole']>, label: string, option: string | RegExp) {
  await scope.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

test('creating a server opens its overview and lists it', async ({ page }) => {
  await page.goto('./servers');
  await page.getByRole('link', { name: '서버 추가' }).first().click();
  await expect(page).toHaveURL(/\/servers\/new$/);
  await expect(page.getByRole('heading', { level: 1, name: '서버 추가' })).toBeVisible();

  const name = page.getByRole('textbox', { name: '이름' });
  const submit = page.getByRole('button', { name: '서버 만들기' });
  // 비어 있거나 공백뿐인 이름은 브라우저 검증이 막는다.
  await submit.click();
  await expect(name).toHaveJSProperty('validity.valid', false);
  await name.fill('   ');
  await submit.click();
  await expect(name).toHaveJSProperty('validity.valid', false);
  await expect(page).toHaveURL(/\/servers\/new$/);

  await name.fill('new-box');
  await submit.click();
  await expect(page).toHaveURL(/\/servers\/server_mock_[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'new-box' })).toBeVisible();
  await expect(page.getByText('아직 연결한 기능이 없습니다')).toBeVisible();
  await expect(page.getByText('서버를 만들었습니다')).toBeVisible();
  await expect(page.getByRole('tabpanel')).toBeFocused();

  // 추가 화면은 기록에서 바뀌었으므로 뒤로 가기 한 번이면 목록이다.
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
  await expect(serverLink(page, 'new-box')).toBeVisible();
});

test('a name taken in the same group is shown under the name field', async ({ page }) => {
  await page.goto('./servers/new');
  const name = page.getByRole('textbox', { name: '이름' });
  await name.fill('edge-host-01');
  await choose(page, page.locator('form'), '그룹', 'Production');
  await page.getByRole('button', { name: '서버 만들기' }).click();
  await expect(page.getByText('이 그룹에 같은 이름의 서버가 있습니다')).toBeVisible();
  await expect(name).toHaveValue('edge-host-01');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription(/이 그룹에 같은 이름의 서버가 있습니다/);
  await expect(name).toBeFocused();
  await expect(page).toHaveURL(/\/servers\/new$/);
});

test('server settings rename the server and change its group', async ({ page }) => {
  await page.goto('./servers/server_mock_payments_api');
  await expect(serverHeader(page)).toContainText('Production');

  let dialog = await openSettings(page);
  await expect(dialog.getByRole('textbox', { name: '이름' })).toHaveValue('payments-api');
  await dialog.getByRole('textbox', { name: '이름' }).fill('payments-core');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'payments-core' })).toBeVisible();
  await expect(page.getByText('서버 설정을 저장했습니다')).toBeVisible();

  dialog = await openSettings(page);
  await choose(page, dialog, '그룹', 'Backoffice');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(serverHeader(page)).toContainText('Backoffice');
  // 수정은 전체 교체다. 그룹만 바꿔도 이름이 유지된다.
  await expect(page.getByRole('heading', { level: 1, name: 'payments-core' })).toBeVisible();
});

test('merging moves the targets to the chosen server and removes this one', async ({ page }) => {
  await page.goto('./servers');
  await serverLink(page, 'payments-api').click();
  await expect(page.getByRole('heading', { level: 1, name: 'payments-api' })).toBeVisible();

  const settings = await openSettings(page);
  await settings.getByRole('button', { name: '다른 서버와 합치기' }).click();
  const merge = page.getByRole('dialog', { name: '다른 서버와 합치기' });
  await expect(merge).toBeVisible();
  await choose(page, merge, '대상 서버', 'staging-empty (미분류)');
  await expect(merge).toContainText('이 서버의 대상을 모두 staging-empty으로 옮기고 이 서버를 삭제합니다.');
  await expect(merge.getByRole('listitem')).toHaveText(['업타임 모니터 1개', '앱 1개']);
  await merge.getByRole('button', { name: '합치기' }).click();

  await expect(page).toHaveURL(/\/servers\/server_mock_staging_empty$/);
  await expect(page.getByRole('heading', { level: 1, name: 'staging-empty' })).toBeVisible();
  await expect(page.getByText('서버를 합쳤습니다')).toBeVisible();
  await expect(page.getByRole('tabpanel')).toBeFocused();
  const tabs = page.getByRole('tablist', { name: '서버 기능' });
  await expect(tabs.getByRole('tab', { name: /업타임.*모니터 1개/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /로그.*앱 1개/ })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
  await expect(serverLink(page, 'staging-empty')).toBeVisible();
  await expect(serverLink(page, 'payments-api')).toHaveCount(0);
});

test('servers that already have infrastructure cannot take another one', async ({ page }) => {
  await page.goto('./servers/server_mock_edge_host_01');
  const settings = await openSettings(page);
  await settings.getByRole('button', { name: '다른 서버와 합치기' }).click();
  const merge = page.getByRole('dialog', { name: '다른 서버와 합치기' });
  await merge.getByRole('combobox', { name: '대상 서버' }).click();
  await expect(page.getByRole('option', { name: /^db-primary-01 \(Production\).*인프라 리소스가 이미 있습니다/ })).toBeDisabled();
  await expect(page.getByRole('option', { name: /^batch-host-01/ })).toBeDisabled();
  await expect(page.getByRole('option', { name: 'staging-empty (미분류)' })).toBeEnabled();
  await expect(page.getByRole('option', { name: /^edge-host-01/ })).toHaveCount(0);
});

test('deleting a server lists what goes with it and returns to the list', async ({ page }) => {
  await page.goto('./servers');
  await serverLink(page, 'batch-host-01').click();
  const settings = await openSettings(page);
  await settings.getByRole('button', { name: '서버 삭제' }).click();
  const confirm = page.getByRole('dialog', { name: '서버를 삭제할까요?' });
  await expect(confirm.getByRole('listitem')).toHaveText(['업타임 모니터 1개', '앱 2개', '인프라 리소스 1개']);
  await expect(confirm).toContainText('수집된 데이터도 함께 삭제됩니다.');
  await confirm.getByRole('button', { name: '삭제' }).click();

  await expect(page).toHaveURL(/\/servers$/);
  await expect(page.getByText('서버를 삭제했습니다')).toBeVisible();
  await expect(serverLink(page, 'edge-host-01')).toBeVisible();
  await expect(serverLink(page, 'batch-host-01')).toHaveCount(0);
});
