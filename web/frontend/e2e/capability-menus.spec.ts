import { expect, test } from '@playwright/test';
import { dockerService, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

// With only a Docker environment connected, every capability menu is empty and
// points to where the Docker Collector's data lives (ADR 0007).
for (const [menu, title] of [
  ['로그', '아직 로그 서비스가 없습니다'],
  ['메트릭', '아직 연결된 메트릭 서비스가 없습니다'],
  ['API 요청', '표시할 API 대상이 없습니다'],
  ['인프라', '표시할 인프라가 없습니다'],
  ['업타임', '표시할 업타임 대상이 없습니다'],
] as const) {
  test(`${menu} is empty for a Docker-only setup and links to Docker environments`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.monitors = [];
    state.services = [dockerService()];
    // The dev server proxies /api to the backend, so reach each menu through client routing.
    await page.goto('./');
    await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: menu, exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Docker API', exact: true })).toHaveCount(0);
    await page.getByRole('main').getByRole('link', { name: 'Docker 환경', exact: true }).click();
    await expect(page).toHaveURL(/\/environments$/);
  });
}
