import { expect, test } from '@playwright/test';

test.describe('live demo', () => {
  test('visitor can open the dashboard without logging in', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('complementary').getByText('Live Demo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '모니터링 개요' })).toBeVisible();
    // 개요의 KPI 행은 제거됐다 — 아래 두 카드가 같은 말을 더 정확히 하고 있었다.
    // 장애 신호는 이제 개수가 아니라 대상 이름으로 확인한다.
    await expect(page.getByRole('heading', { name: '현재 확인 필요' })).toBeVisible();
    await expect(page.getByText('장애가 발생했습니다')).toBeVisible();
    await expect(page.getByRole('heading', { name: '모니터링 범위' })).toBeVisible();
  });

  test('visitor can inspect logs for a Docker service', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('link', { name: 'Docker 환경', exact: true }).click();
    await page.getByRole('button', { name: 'prod-server', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();

    await page.getByRole('button', { name: 'api', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'api' })).toBeVisible();

    await page.getByRole('tab', { name: '로그', exact: true }).click();
    await expect(page.getByText('Connection timeout to upstream: auth.internal:8080 after 5000ms')).toBeVisible();
  });

  test('trace jump keeps the Docker target and filters requests by trace ID', async ({ page }) => {
    await page.goto('./services/agent_demo_01/shop%3Aapi?tab=logs');
    await expect(page.getByText('Connection timeout to upstream: auth.internal:8080 after 5000ms')).toBeVisible();
    await page.getByRole('button', { name: '트레이스', exact: true }).first().click();

    await expect(page.getByRole('dialog', { name: '트레이스 상세' })).toBeVisible();
    await page.getByRole('dialog', { name: '트레이스 상세' }).getByRole('button', { name: /^API 요청 \(/ }).click();

    await expect(page).toHaveURL(/\/services\/agent_demo_01\/shop%3Aapi\?tab=requests&traceId=/);
    await expect(page.getByText('/api/v1/auth/login', { exact: true })).toBeVisible();
    await expect(page.getByText('/api/v1/payments', { exact: true })).toHaveCount(0);
  });

  test('alert rules use exact target identifiers from the URL', async ({ page }) => {
    await page.goto('./alerts?tab=rules&target=agent&agentId=agent_123&serviceKey=api');

    await expect(page.getByRole('status').filter({ hasText: '대상:' })).toContainText('api');
    await expect(page.getByText('Service Down', { exact: true })).toBeVisible();
    await expect(page.getByText('High CPU Usage', { exact: true })).toHaveCount(0);

    await page.goto('./alerts?tab=rules&target=direct&serviceId=another-api');
    await expect(page.getByText('Service Down', { exact: true })).toHaveCount(0);
    await expect(page.getByText('조건에 맞는 규칙이 없습니다', { exact: false })).toBeVisible();
  });

  test('project overview includes Docker service outages and resolves legacy environment URLs', async ({ page }) => {
    await page.goto('./projects/project_mock_production');
    await expect(page.getByRole('heading', { level: 1, name: 'Production' })).toBeVisible();
    await expect(page.getByText('Docker 서비스 장애', { exact: true })).toBeVisible();

    await page.goto('./projects/agent_demo_01');
    await expect(page).toHaveURL(/\/agents\/agent_demo_01$/);
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();
  });

  test('mobile keeps the primary destinations in the bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');

    await expect(page.getByRole('button', { name: '데모 시나리오' })).toBeVisible();
    await expect(page.getByRole('link', { name: '개요', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '알림', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '더보기', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '더보기' })).toBeVisible();
  });

  test('empty scenario explains how to start monitoring', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '데모 시나리오' }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: '첫 시작' }).click();

    await expect(page.getByText('아직 모니터링 대상이 없습니다')).toBeVisible();
    await expect(page.locator('section').filter({ hasText: '아직 모니터링 대상이 없습니다' }).getByRole('button', { name: 'Docker 연결', exact: true })).toBeVisible();
  });

  test('normal scenario shows that no action is needed', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: '정상 운영' }).click();

    await expect(page.getByText('현재 확인이 필요한 이상이 없습니다')).toBeVisible();
  });

  test('overview timeline lists outages from both history sources', async ({ page }) => {
    await page.goto('./');

    const timeline = page.getByRole('region', { name: '최근 장애 이력' });
    await expect(timeline).toBeVisible();
    // Scope is part of the claim: direct-connection services keep no history,
    // so the card must not imply it covers every monitored target.
    await expect(timeline.getByText('업타임 모니터와 Docker 서비스의 최근 7일 기록입니다.')).toBeVisible();

    // An ongoing Docker outage and a resolved uptime episode, newest first.
    await expect(timeline.getByRole('link', { name: /payment-worker/ })).toBeVisible();
    await expect(timeline.getByText('HTTP 503 from origin')).toBeVisible();

    // The server builds targetPath; following it must land on the real target.
    await timeline.getByRole('link', { name: /payment-worker/ }).click();
    await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('payment-worker');
  });

  test('partial failure preserves successful overview regions', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: '부분 수집 실패' }).click();

    await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
    // 성공한 영역이 남아 있는지를 '모니터링 범위' 카드로 확인한다. `직접 연결 서비스`는
    // 사이드바 메뉴명과 겹치지 않아 스코프 없이도 유일하다.
    await expect(page.getByRole('heading', { name: '모니터링 범위' })).toBeVisible();
    await expect(page.getByText('직접 연결 서비스', { exact: true })).toBeVisible();
  });
});
