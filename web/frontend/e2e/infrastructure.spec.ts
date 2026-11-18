import { expect, test } from '@playwright/test';

// 인프라 메뉴 점검(plans/infra-menu-ux-evaluation-results.md)에서 고친 동작. 서버 구성은 src/mocks/SCENARIOS.md를 따른다.
// 옛 인프라 목록(사용률 순 정렬)은 서버 목록이 대신한다. 상태가 나쁜 순서와 사용률 원인은 servers-list.spec.ts가 확인한다.

test('infrastructure detail shows that host\'s own values in the chart headers', async ({ page }) => {
  await page.goto('./servers/server_mock_db_primary_01/infrastructure');
  const memory = page.locator('section', { has: page.getByRole('heading', { name: '메모리', exact: true }) });
  await expect(memory.getByText('84.6%')).toBeVisible();
  // 상태는 연결 여부(연결 활성)가 아니라 수집한 값으로 말한다. 서버 탭에서는 서버 목록과 같은 판정과 그 원인이다.
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('메모리 84.6%, 기준 70%', { exact: true })).toBeVisible();
  await expect(panel.getByText(/^마지막 수집/)).toBeVisible();
  await expect(page.getByText('연결 활성')).toHaveCount(0);
  await expect(memory.getByText('주의')).toBeVisible();

  // 툴팁은 마우스 전용이라, 키보드로 고른 시점의 값은 차트 아래 글로 읽힌다.
  await memory.getByRole('group', { name: /메모리 추이/ }).focus();
  await page.keyboard.press('End');
  await expect(memory.getByText(/사용률 84\.6 %/)).toBeVisible();
});

// 데모: payments-api 서버에는 인프라가 없다.
test('a host that has not sent metrics yet says it is waiting, not empty charts', async ({ page }) => {
  await page.goto('./servers/server_mock_payments_api/infrastructure');
  await page.getByRole('button', { name: '인프라 연결', exact: true }).first().click();
  // 서버 탭에서는 이름을 묻지 않고 서버 이름(payments-api)으로 만든다.
  const dialog = page.getByRole('dialog', { name: 'OpenTelemetry Collector 연결' });
  await dialog.getByRole('button', { name: '추가' }).click();
  await expect(dialog.getByText('Collector를 실행하면 30초 안에 첫 메트릭이 들어옵니다.', { exact: false })).toBeVisible();
  // "인프라 보기"는 방금 만든 리소스의 상세로 간다. 서버마다 리소스가 하나라 탭 주소가 곧 그 상세다.
  await dialog.getByRole('button', { name: '인프라 보기' }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/infrastructure$/);
  await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2, name: '인프라', exact: true })).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Collector 수신 대기' })).toBeVisible();
  await expect(page.getByText('수신 대기').first()).toBeVisible();
});
