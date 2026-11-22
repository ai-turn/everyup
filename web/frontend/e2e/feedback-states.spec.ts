import { expect, test, type Page } from '@playwright/test';
import { ApiError, getErrorMessage } from '../src/utils/errors';

// UI/UX 점검(2026-11-20) A1·A2·A3·A5: 실패 상태, 오류 문구, 탭 제목, 폼 검증.
// 데모 시나리오는 sessionStorage로 고른다(src/mocks/demoScenario.ts).
async function scenario(page: Page, value: 'attention' | 'normal' | 'partial-failure') {
  await page.addInitScript((name) => window.sessionStorage.setItem('everyup_demo_scenario', name), value);
}

test.describe('A1·A2 load failures', () => {
  test('a failed container list keeps the Docker servers and says what is missing, without an empty or no-results state', async ({ page }) => {
    await scenario(page, 'partial-failure');
    await page.goto('./servers?connection=docker');
    const banner = page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('컨테이너');
    await expect(banner).not.toContainText('Demo scenario');
    await expect(page.getByRole('table', { name: '서버 그리드' }).getByRole('link', { name: 'prod-server', exact: true })).toBeVisible();
    await expect(page.getByText('검색 결과가 없습니다')).toHaveCount(0);
    await expect(page.getByText('아직 서버가 없습니다')).toHaveCount(0);
  });

  test('a rule whose target name could not be loaded says so and dims the ID', async ({ page }) => {
    await scenario(page, 'partial-failure');
    await page.goto('./alerts');
    const table = page.getByRole('table', { name: '알림 규칙 그리드' });
    const missing = table.getByText('이름을 불러오지 못한 대상').first();
    await expect(missing).toBeVisible();
    const id = missing.locator('span.text-text-dim');
    await expect(id).toHaveText(/\S/);
    // 내부 ID만 맨 글자로 남은 칸이 없다.
    await expect(table.locator('td').filter({ hasText: /^(observed_mock_\w+|shop:api)$/ })).toHaveCount(0);
  });

  test('error messages never show raw server or browser text', () => {
    expect(getErrorMessage(new ApiError('server not found', 'NOT_FOUND', 404))).toBe('요청한 항목을 찾을 수 없습니다.');
    expect(getErrorMessage(new ApiError('upstream exploded', 'SOME_NEW_CODE', 503))).toBe('서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
    expect(getErrorMessage(new ApiError('HTTP Error: 502', 'UNKNOWN_ERROR', 502))).toBe('서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
    expect(getErrorMessage(new ApiError('bad thing', 'SOME_NEW_CODE', 400))).toBe('알 수 없는 오류가 발생했습니다.');
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe('서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.');
    expect(getErrorMessage(new Error('Cannot read properties of undefined'))).toBe('알 수 없는 오류가 발생했습니다.');
    // 앱이 직접 쓴 한국어 문구는 그대로 둔다.
    expect(getErrorMessage(new Error('Docker 환경을 찾을 수 없습니다'))).toBe('Docker 환경을 찾을 수 없습니다');
  });
});

test.describe('A3 tab title', () => {
  test('the title names the current location and keeps the outage count on every screen', async ({ page }) => {
    await scenario(page, 'attention');
    await page.goto('./');
    await expect(page).toHaveTitle(/^\(\d+\) 장애 · 개요 · EveryUp$/);
    const count = (await page.title()).match(/^\((\d+)\)/)![1];
    await page.goto('./servers');
    await expect(page).toHaveTitle(`(${count}) 장애 · 서버 · EveryUp`);
    await page.goto('./servers/server_mock_edge_host_01');
    await expect(page).toHaveTitle(`(${count}) 장애 · edge-host-01 · EveryUp`);
  });

  test('without outages the title is the location only', async ({ page }) => {
    await scenario(page, 'normal');
    await page.goto('./alerts');
    await expect(page).toHaveTitle('알림 · EveryUp');
  });
});

test.describe('A5 inline form validation', () => {
  test('the group form shows the missing name under the field instead of a browser bubble', async ({ page }) => {
    await page.goto('./projects');
    await page.getByRole('button', { name: '추가', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: '그룹 추가' });
    await expect(dialog.locator('form')).toHaveAttribute('novalidate', '');
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    const name = dialog.getByRole('textbox', { name: '이름', exact: true });
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription('그룹 이름을 입력하세요');
    await name.fill('Payments');
    await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('the server settings form validates the name inline and has no title tooltip', async ({ page }) => {
    await page.goto('./servers/server_mock_edge_host_01');
    await page.locator('header', { has: page.getByRole('heading', { level: 1 }) }).getByRole('button', { name: '서버 설정' }).click();
    const dialog = page.getByRole('dialog', { name: '서버 설정' });
    const name = dialog.getByRole('textbox', { name: '이름', exact: true });
    await expect(name).not.toHaveAttribute('title');
    await name.fill('');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(name).toHaveAccessibleDescription('서버 이름을 입력하세요');
    await expect(dialog).toBeVisible();
  });
});
