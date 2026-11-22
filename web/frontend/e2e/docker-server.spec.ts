import { expect, test } from '@playwright/test';

// Docker 환경은 같은 ID의 서버다(ADR 0012). Docker Collector가 있는 서버는 컨테이너 탭을 갖고,
// Docker Collector가 모으는 호스트 지표·컨테이너 로그·요청은 그 서버의 기능 탭에 함께 보인다.
test.describe('docker server', () => {
  test('the server list holds the Docker host and finds it by a container name', async ({ page }) => {
    await page.goto('./servers');
    const grid = page.getByRole('table', { name: '서버 그리드' });
    const row = grid.getByRole('row').filter({ has: page.getByRole('link', { name: 'prod-server', exact: true }) });
    await expect(row.getByText(/^Docker Collector · 컨테이너 \d+개$/)).toBeVisible();
    await page.getByRole('textbox', { name: '서버 또는 대상 검색' }).fill('payment-worker');
    await expect(grid.getByRole('link', { name: 'prod-server', exact: true })).toBeVisible();
  });

  test('tabs hold the containers, host metrics, container logs and requests', async ({ page }) => {
    await page.goto('./servers/agent_demo_01');
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();
    const tabs = page.getByRole('tablist', { name: '서버 기능' });
    await expect(tabs.getByRole('tab', { name: /^컨테이너/ })).toBeVisible();
    // 개요는 컨테이너 행을 기능 행과 같은 틀로 보인다.
    await expect(page.getByRole('heading', { name: '컨테이너', exact: true })).toBeVisible();

    await tabs.getByRole('tab', { name: /^컨테이너/ }).click();
    await expect(page).toHaveURL(/\/servers\/agent_demo_01\/containers$/);
    await expect(page.getByRole('table', { name: '컨테이너 그리드' }).getByRole('link', { name: 'payment-worker' })).toBeVisible();

    await tabs.getByRole('tab', { name: /^인프라/ }).click();
    await expect(page).toHaveURL(/\/servers\/agent_demo_01\/infrastructure$/);
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('CPU').first()).toBeVisible();
    await expect(panel.getByText('디스크', { exact: true }).first()).toBeVisible();

    // 뒤로 가기는 이전 탭으로 돌아간다.
    await page.goBack();
    await expect(tabs.getByRole('tab', { name: /^컨테이너/ })).toHaveAttribute('aria-selected', 'true');
    await page.goForward();

    await tabs.getByRole('tab', { name: /^로그/ }).click();
    const logs = page.locator('section', { has: page.getByRole('heading', { name: '컨테이너 로그', exact: true }) });
    await expect(logs.getByRole('link').first()).toHaveText('payment-worker');
    await page.getByRole('link', { name: /Payment gateway timeout after 5000ms.*24회/ }).click();
    await expect(page).toHaveURL(/\/services\/agent_demo_01\/shop%3Apayment-worker\?tab=logs&range=24h&pattern=/);
  });

  test('the header carries the Docker Collector actions', async ({ page }) => {
    await page.goto('./servers/agent_demo_01');
    await page.getByRole('button', { name: '더보기' }).click();
    await expect(page.getByRole('menuitem', { name: 'API Key' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Docker Collector 비활성화' })).toBeVisible();
  });

  test('a server without Docker Collector has no containers tab, and its containers address opens the overview', async ({ page }) => {
    await page.goto('./servers/server_mock_edge_host_01/containers');
    await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01$/);
    await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^컨테이너/ })).toHaveCount(0);
  });
});
