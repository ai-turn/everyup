import { expect, test, type Page } from '@playwright/test';

// 대상 상세는 연결 방식과 상관없이 같은 머리말과 수치 묶음을 쓴다(DESIGN.md §4.7 대상 상세, 소유자 결정 2026-11-21).
const kpiLabels = (page: Page) => page.locator('section')
  .filter({ has: page.getByRole('heading', { name: '주요 지표', exact: true }) }).locator('dt');

test('a Docker service shows how it is connected and where to change it', async ({ page }) => {
  await page.goto('./services/agent_demo_01/shop%3Aapi');
  const connection = page.locator('[data-connection="docker"]:visible');
  await expect(connection).toContainText('연결 Docker Collector');
  await expect(connection).toContainText('prod-server 환경');
  await connection.getByRole('link', { name: '설정 가이드' }).click();
  await expect(page).toHaveURL(/\/servers\/agent_demo_01$/);
});

test('an uptime monitor and a Docker service show the same uptime figures, in the same order', async ({ page }) => {
  await page.goto('./servers/server_mock_edge_host_01/uptime/uptime_mock_store');
  // HTTPS 모니터만 인증서 칸이 더 붙는다.
  await expect(kpiLabels(page)).toHaveText(['24시간 업타임', '30일 업타임', '평균 응답 (24시간)', '인증서 만료']);
  await page.goto('./services/agent_demo_01/shop%3Aapi');
  await expect(kpiLabels(page)).toHaveText(['24시간 업타임', '30일 업타임', '평균 응답 (24시간)']);
  // 수치 → 응답 시간 → 90일 띠 순서다.
  const order = await page.evaluate(() => ['주요 지표', '응답 시간', '업타임 현황'].map((name) =>
    [...document.querySelectorAll('h2, h3')].find((heading) => heading.textContent?.trim() === name)?.getBoundingClientRect().top ?? -1));
  expect(order.every((top, index) => top >= 0 && (index === 0 || top > order[index - 1]))).toBe(true);
});

test('on a phone the connection shares the back-link row instead of taking its own line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./services/agent_demo_01/shop%3Aapi');
  const connection = page.locator('[data-connection="docker"]:visible');
  await expect(connection).toHaveCount(1);
  await expect(connection).toContainText('Docker Collector');
  await expect(connection.getByRole('link', { name: '설정 가이드' })).toBeVisible();
  const back = await page.getByRole('link', { name: 'prod-server' }).first().boundingBox();
  const line = await connection.boundingBox();
  expect(Math.abs(back!.y + back!.height / 2 - (line!.y + line!.height / 2))).toBeLessThan(2);
});
