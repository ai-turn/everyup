import { expect, test } from '@playwright/test';

test.describe('live demo', () => {
  test('visitor can open the dashboard without logging in', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('complementary').getByText('Live Demo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '개요', exact: true })).toBeVisible();
    // 개요의 KPI 행은 제거됐다 — 아래 두 카드가 같은 말을 더 정확히 하고 있었다.
    // 장애 신호는 이제 개수가 아니라 대상 이름으로 확인한다.
    await expect(page.getByRole('heading', { name: '현재 확인 필요' })).toBeVisible();
    await expect(page.locator('#attention').getByRole('link', { name: /payment-worker/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '모니터링 범위' })).toBeVisible();
  });

  test('visitor can inspect logs for a Docker service', async ({ page }) => {
    await page.goto('./');

    // Docker 호스트도 서버다(ADR 0012). 컨테이너는 그 서버의 컨테이너 탭에 있다.
    await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '서버', exact: true }).click();
    await page.getByRole('link', { name: 'prod-server', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();
    await page.getByRole('tab', { name: /^컨테이너/ }).click();

    await page.getByRole('table', { name: '컨테이너 그리드' }).getByRole('link', { name: 'api', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'api' })).toBeVisible();
    // 상세 경로도 담긴 섹션에 속한다(navSections.ts) — 사이드바 활성 항목과 첫 크럼이 같은 섹션이다.
    await expect(page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '서버', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: '서버', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: '로그', exact: true }).click();
    await expect(page.getByText('Connection timeout to upstream: auth.internal:8080 after 5000ms').first()).toBeVisible();
  });

  test('trace jump keeps the Docker target and filters requests by trace ID', async ({ page }) => {
    await page.goto('./servers/agent_demo_01/containers/shop%3Aapi?tab=logs');
    // The row's summary line holds the message and its trace button (the row itself is not a button).
    const timeoutLog = page.getByText('Connection timeout to upstream: auth.internal:8080 after 5000ms', { exact: true }).first().locator('xpath=..');
    await expect(timeoutLog).toBeVisible();
    await timeoutLog.getByRole('button', { name: '트레이스', exact: true }).click();

    await expect(page.getByRole('dialog', { name: '트레이스 상세' })).toBeVisible();
    await page.getByRole('dialog', { name: '트레이스 상세' }).getByRole('button', { name: /^API 요청 \(/ }).click();

    await expect(page).toHaveURL(/\/servers\/agent_demo_01\/containers\/shop%3Aapi\?tab=requests&traceId=/);
    // The endpoint table lists the same paths, so match the request rows (their buttons open the trace).
    await expect(page.getByRole('button', { name: /^POST 200 \/api\/v1\/auth\/login/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^[A-Z]+ \d{3} \/api\/v1\/payments/ })).toHaveCount(0);
  });

  test('alert rules use exact target identifiers from the URL', async ({ page }) => {
    await page.goto('./alerts?tab=rules&target=agent&agentId=agent_demo_01&serviceKey=shop%3Aapi');

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
    // 장애 컨테이너는 그 Docker 서버 행의 원인이다(ADR 0012).
    const outage = page.getByRole('row').filter({ hasText: 'payment-worker' });
    await expect(outage).toContainText('서버 · Docker Collector');
    await expect(outage).toContainText('장애');

    await page.goto('./projects/agent_demo_01');
    await expect(page).toHaveURL(/\/servers\/agent_demo_01$/);
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();
  });

  test('mobile keeps the primary destinations in the bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');

    await expect(page.getByRole('combobox', { name: '데모 시나리오' })).toBeVisible();
    await expect(page.getByRole('link', { name: '개요', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '서버', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '알림', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '더보기', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '더보기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '더보기', exact: true })).toHaveAttribute('aria-current', 'page');
    // 사이드바가 없는 폭에서는 더보기가 하단 내비 밖의 섹션에 닿는 유일한 경로다.
    for (const section of ['그룹', '환경 설정']) {
      await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
    }
  });

  test('empty scenario explains how to start monitoring', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('combobox', { name: '데모 시나리오' }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: '첫 시작' }).click();

    await expect(page.getByText('아직 모니터링 대상이 없습니다')).toBeVisible();
    // 시작은 서버 추가 하나다. Docker 호스트도 서버 추가에서 연결 방식으로 고른다.
    const empty = page.locator('section').filter({ hasText: '아직 모니터링 대상이 없습니다' });
    await expect(empty.getByRole('link', { name: '서버 추가', exact: true })).toBeVisible();
    await expect(empty.getByRole('link', { name: 'Docker 연결', exact: true })).toHaveCount(0);
  });

  test('normal scenario shows that no action is needed', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('combobox', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: '정상 운영' }).click();

    await expect(page.getByText('현재 확인이 필요한 이상이 없습니다')).toBeVisible();
    // 서버 목록도 같은 판정이다. 장애나 확인 필요인 서버가 없다.
    await page.getByRole('link', { name: '서버', exact: true }).first().click();
    const rows = page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasText: /장애|확인 필요/ })).toHaveCount(0);
  });

  test('overview timeline lists outages from both history sources', async ({ page }) => {
    await page.goto('./');

    const timeline = page.getByRole('region', { name: '최근 장애 이력' });
    await expect(timeline).toBeVisible();
    // Scope is part of the claim: direct-connection services keep no history,
    // so the card must not imply it covers every monitored target.
    await expect(timeline.getByText('업타임 모니터·Docker 서비스, 최근 7일')).toBeVisible();

    // An ongoing Docker outage and a resolved uptime episode, newest first.
    await expect(timeline.getByRole('link', { name: /payment-worker/ })).toBeVisible();
    await expect(timeline.getByText('upstream timeout')).toBeVisible();

    // The server builds targetPath; following it must land on the real target.
    await timeline.getByRole('link', { name: /payment-worker/ }).click();
    await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('payment-worker');
  });

  test('partial failure preserves successful overview regions', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('combobox', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: '부분 수집 실패' }).click();

    await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
    // 성공한 영역이 남아 있는지를 '모니터링 범위' 줄로 확인한다. 이 시나리오는 앱 목록만 실패하므로 서버 수는 보인다.
    const scope = page.getByRole('navigation', { name: '모니터링 범위' });
    await expect(scope).toBeVisible();
    await expect(scope.getByRole('link', { name: /^서버 \d+$/ })).toBeVisible();
  });
});
