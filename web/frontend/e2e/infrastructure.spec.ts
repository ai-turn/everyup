import { expect, test } from '@playwright/test';

// 인프라 메뉴 점검(plans/infra-menu-ux-evaluation-results.md)에서 고친 동작.
test('infrastructure list puts the busiest host first and marks warning levels', async ({ page }) => {
  await page.goto('./infrastructure?view=grid');
  const table = page.getByRole('table', { name: '인프라 대상 그리드' });
  // db-primary-01 메모리 84.6% > batch-host-01 CPU 76.1% > edge-host-01 메모리 72.8% > staging-host-01
  await expect(table.locator('tbody tr a[data-row-link]')).toHaveText(['db-primary-01', 'batch-host-01', 'edge-host-01', 'staging-host-01']);
  await expect(page.getByText('서버 4개 · 사용률 높은 순')).toBeVisible();
  // 행 안에 모바일 요약과 메모리 열이 함께 있다 — 데스크톱에서 보이는 것은 열 쪽이다.
  await expect(table.locator('tbody tr').first().getByText('84.6% 주의').last()).toBeVisible();
});

test('infrastructure detail shows that host\'s own values in the chart headers', async ({ page }) => {
  await page.goto('./infrastructure/infra_mock_db_01');
  const memory = page.locator('section', { has: page.getByRole('heading', { name: '메모리', exact: true }) });
  await expect(memory.getByText('84.6%')).toBeVisible();
  await expect(page.getByText('수집 중').first()).toBeVisible();
  await expect(page.getByText('연결 활성')).toHaveCount(0);
  await expect(memory.getByText('주의')).toBeVisible();

  // 툴팁은 마우스 전용이라, 키보드로 고른 시점의 값은 차트 아래 글로 읽힌다.
  await memory.getByRole('group', { name: /메모리 추이/ }).focus();
  await page.keyboard.press('End');
  await expect(memory.getByText(/사용률 84\.6 %/)).toBeVisible();
});

test('a host that has not sent metrics yet says it is waiting, not empty charts', async ({ page }) => {
  await page.goto('./infrastructure');
  await page.getByRole('button', { name: '인프라 연결', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('인프라 이름').fill('fresh-host');
  await dialog.getByRole('button', { name: '추가' }).click();
  await expect(dialog.getByText('Collector를 실행하면 30초 안에 첫 메트릭이 들어옵니다.', { exact: false })).toBeVisible();
  // "인프라 보기"는 방금 만든 호스트의 상세로 간다.
  await dialog.getByRole('button', { name: '인프라 보기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'fresh-host' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collector 수신 대기' })).toBeVisible();
  await expect(page.getByText('수신 대기').first()).toBeVisible();
});
