import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크) 이동한다.
const serverHeader = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
const serverRows = (page: Page) => page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');
const serverLink = (page: Page, name: string) => serverRows(page).getByRole('link', { name, exact: true });

async function openSettings(page: Page) {
  await serverHeader(page).getByRole('button', { name: '서버 설정' }).click();
  return page.getByRole('dialog', { name: '서버 설정' });
}

async function openMerge(page: Page) {
  const settings = await openSettings(page);
  await settings.getByRole('button', { name: '다른 서버 합치기' }).click();
  return page.getByRole('dialog', { name: '다른 서버 합치기' });
}

async function choose(page: Page, scope: ReturnType<Page['getByRole']>, label: string, option: string | RegExp) {
  await scope.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

test('creating a server opens its overview and lists it', async ({ page }) => {
  await page.goto('./servers');
  // 목록 머리말의 생성 버튼은 `추가`다(DESIGN.md §4.1 액션 앵커).
  await page.getByRole('link', { name: '추가', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/new$/);
  await expect(page.getByRole('heading', { level: 1, name: '서버 추가' })).toBeVisible();

  const name = page.getByRole('textbox', { name: '이름' });
  const submit = page.getByRole('button', { name: '서버 추가', exact: true });
  // 비어 있거나 공백뿐인 이름은 입력 아래의 오류로 막는다(브라우저 말풍선이 아니다, UI/UX 점검 A5).
  await submit.click();
  await expect(name).toHaveAccessibleDescription('서버 이름을 입력하세요');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  await name.fill('   ');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await submit.click();
  await expect(name).toHaveAccessibleDescription('서버 이름을 입력하세요');
  await expect(page).toHaveURL(/\/servers\/new$/);
  await expect(page.locator('form')).toHaveAttribute('novalidate', '');

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
  await page.getByRole('button', { name: '서버 추가', exact: true }).click();
  await expect(page.getByText('이 그룹에 같은 이름의 서버가 있습니다')).toBeVisible();
  await expect(name).toHaveValue('edge-host-01');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription(/이 그룹에 같은 이름의 서버가 있습니다/);
  await expect(name).toBeFocused();
  await expect(page).toHaveURL(/\/servers\/new$/);
});

test('server settings rename the server and change its group, keeping the description', async ({ page }) => {
  // Public status에는 설명이 있다. 수정은 전체 교체이므로 설명을 빠뜨리면 지워진다.
  await page.goto('./servers/server_mock_public_status');
  await expect(serverHeader(page)).toContainText('Production');
  await expect(serverHeader(page)).toContainText('외부 상태 페이지');

  let dialog = await openSettings(page);
  await expect(dialog.getByRole('textbox', { name: '이름' })).toHaveValue('Public status');
  await dialog.getByRole('textbox', { name: '이름' }).fill('status-page');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'status-page' })).toBeVisible();
  await expect(page.getByText('서버 설정을 저장했습니다')).toBeVisible();

  dialog = await openSettings(page);
  await expect(dialog.getByRole('textbox', { name: '설명' })).toHaveValue('외부 상태 페이지');
  await choose(page, dialog, '그룹', 'Backoffice');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(serverHeader(page)).toContainText('Backoffice');
  await expect(serverHeader(page)).toContainText('외부 상태 페이지');
  await expect(page.getByRole('heading', { level: 1, name: 'status-page' })).toBeVisible();
});

test('settings put server management above the save row', async ({ page }) => {
  await page.goto('./servers/server_mock_public_status');
  const dialog = await openSettings(page);
  // 오른쪽 아래 끝(주 액션 자리)은 저장이다. 삭제가 그 자리에 오지 않는다.
  await expect(dialog.getByRole('button').last()).toHaveText('저장');
  const remove = (await dialog.getByRole('button', { name: '서버 삭제' }).boundingBox())!;
  const save = (await dialog.getByRole('button', { name: '저장' }).boundingBox())!;
  expect(remove.y).toBeLessThan(save.y);
});

test('merging brings the chosen servers into this one and removes them', async ({ page }) => {
  await page.goto('./servers');
  await serverLink(page, 'staging-empty').click();
  await expect(page.getByRole('heading', { level: 1, name: 'staging-empty' })).toBeVisible();

  const merge = await openMerge(page);
  await expect(merge).toContainText('선택한 서버의 대상을 모두 이 서버로 옮기고, 선택한 서버는 삭제합니다.');
  await expect(merge.getByRole('checkbox', { name: /^staging-empty/ })).toHaveCount(0);
  await expect(merge.getByRole('list', { name: '합칠 서버 (8개)' })).toBeVisible();
  const payments = merge.getByRole('checkbox', { name: /^payments-api \(Production\)/ });
  await expect(payments).toHaveAccessibleName(/업타임 모니터 1개, 앱 1개/);
  await payments.check();
  await merge.getByRole('checkbox', { name: /^Mail relay \(Backoffice\)/ }).check();
  await expect(merge.getByRole('list', { name: '대상 개수' }).getByRole('listitem')).toHaveText(['업타임 모니터 2개', '앱 1개']);
  await expect(merge).toContainText('선택한 서버 2개는 삭제됩니다.');
  await merge.getByRole('button', { name: '합치기' }).click();

  await expect(merge).toBeHidden();
  await expect(page.getByText('서버 2개를 합쳤습니다')).toBeVisible();
  await expect(page.getByRole('tabpanel')).toBeFocused();
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_empty$/);
  const tabs = page.getByRole('tablist', { name: '서버 기능' });
  await expect(tabs.getByRole('tab', { name: /업타임.*모니터 2개/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /로그.*앱 1개/ })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
  await expect(serverLink(page, 'staging-empty')).toBeVisible();
  await expect(serverLink(page, 'payments-api')).toHaveCount(0);
  await expect(serverLink(page, 'Mail relay')).toHaveCount(0);
});

test('a server with infrastructure cannot take another one', async ({ page }) => {
  await page.goto('./servers/server_mock_edge_host_01');
  const merge = await openMerge(page);
  const db = merge.getByRole('checkbox', { name: /^db-primary-01 \(Production\)/ });
  await expect(db).toBeDisabled();
  await expect(db).toHaveAccessibleName(/인프라 리소스가 이미 있습니다/);
  await expect(merge.getByRole('checkbox', { name: /^batch-host-01/ })).toBeDisabled();
  await expect(merge.getByRole('checkbox', { name: /^staging-empty \(미분류\)/ })).toBeEnabled();
});

test('only one server with infrastructure can be chosen', async ({ page }) => {
  await page.goto('./servers/server_mock_staging_empty');
  const merge = await openMerge(page);
  const checkbox = (name: string) => merge.getByRole('checkbox', { name: new RegExp(`^${name}`) });
  for (const name of ['db-primary-01', 'batch-host-01', 'edge-host-01', 'staging-host-01']) await expect(checkbox(name)).toBeEnabled();
  await checkbox('db-primary-01').check();
  for (const name of ['batch-host-01', 'edge-host-01', 'staging-host-01']) await expect(checkbox(name)).toBeDisabled();
  await expect(checkbox('db-primary-01')).toBeEnabled();
  await expect(checkbox('payments-api')).toBeEnabled();
  await checkbox('db-primary-01').uncheck();
  await expect(checkbox('batch-host-01')).toBeEnabled();
});

test('deleting a server lists what goes with it and returns to the list as it was', async ({ page }) => {
  await page.goto('./servers?group=project_mock_backoffice');
  await serverLink(page, 'batch-host-01').click();
  const settings = await openSettings(page);
  await settings.getByRole('button', { name: '서버 삭제' }).click();
  const confirm = page.getByRole('dialog', { name: 'batch-host-01 서버를 삭제할까요?' });
  await expect(confirm.getByRole('listitem')).toHaveText(['업타임 모니터 1개', '앱 2개', '인프라 리소스 1개']);
  await expect(confirm).toContainText('수집된 데이터도 함께 삭제됩니다.');
  await confirm.getByRole('button', { name: '삭제' }).click();

  // 보던 목록의 필터가 남고, 삭제된 서버의 주소는 기록에서 바뀌었다.
  await expect(page).toHaveURL(/\/servers\?group=project_mock_backoffice$/);
  await expect(page.getByText('서버를 삭제했습니다')).toBeVisible();
  await expect(serverLink(page, 'Mail relay')).toBeVisible();
  await expect(serverLink(page, 'edge-host-01')).toHaveCount(0);
  await expect(serverLink(page, 'batch-host-01')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/servers\?group=project_mock_backoffice$/);
});

test('a server whose target lists failed is not called empty when deleting', async ({ page }) => {
  // 부분 수집 실패에서는 앱 목록이 빠진다. 앱만 가진 inventory-api는 알려진 대상이 0개다.
  await page.goto('./servers/server_mock_inventory_api');
  await page.getByRole('combobox', { name: '데모 시나리오' }).click();
  await page.getByRole('option', { name: '부분 수집 실패', exact: true }).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다')).toBeVisible();
  const settings = await openSettings(page);
  await settings.getByRole('button', { name: '서버 삭제' }).click();
  const confirm = page.getByRole('dialog', { name: 'inventory-api 서버를 삭제할까요?' });
  await expect(confirm).toContainText('대상 목록을 불러오지 못해 함께 삭제될 대상을 확인하지 못했습니다.');
  await expect(confirm).not.toContainText('연결된 대상이 없습니다');
});

test.describe('against the API', () => {
  test.use({ baseURL: API_URL, viewport: { width: 1440, height: 1000 } });

  test('a merge that stops on the second server says how far it got and retries only the rest', async ({ page }) => {
    const at = '2026-11-01T00:00:00Z';
    let servers = ['web-01', 'api-02', 'api-03', 'api-04'].map((name, index) => ({ id: `s${index + 1}`, name, createdAt: at, updatedAt: at }));
    const merges: string[] = [];
    let failOn: string | null = 's3';
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      const merge = path.match(/^\/servers\/([^/]+)\/merge$/);
      if (request.method() === 'POST' && merge) {
        merges.push(merge[1]);
        if (merge[1] === failOn) {
          await route.fulfill({ status: 500, json: { success: false, error: { code: 'DATABASE_ERROR', message: 'Fixture request failed' } } });
          return;
        }
        servers = servers.filter((server) => server.id !== merge[1]);
        await route.fulfill({ json: { success: true, data: servers[0] } });
        return;
      }
      await route.fulfill({ json: { success: true, data: path === '/servers' ? servers : [] } });
    });
    await page.goto('./servers/s1');
    const merge = await openMerge(page);
    for (const name of ['api-02', 'api-03', 'api-04']) await merge.getByRole('checkbox', { name: new RegExp(`^${name}`) }).check();
    await merge.getByRole('button', { name: '합치기' }).click();
    await expect(merge.getByRole('alert')).toContainText('서버 1개를 합친 뒤 api-03에서 멈췄습니다.');
    // 합쳐진 서버는 다시 불러온 목록에서도, 선택에서도 빠진다.
    await expect(merge.getByRole('checkbox', { name: /^api-02/ })).toHaveCount(0);
    await expect(merge).toContainText('선택한 서버 2개는 삭제됩니다.');
    expect(merges).toEqual(['s2', 's3']);

    failOn = null;
    await merge.getByRole('button', { name: '합치기' }).click();
    await expect(merge).toBeHidden();
    expect(merges).toEqual(['s2', 's3', 's3', 's4']);
  });
});
