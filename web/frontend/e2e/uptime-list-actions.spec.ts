import { expect, test } from '@playwright/test';
import { deferred, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

for (const view of ['grid', 'card'] as const) for (const fail of [false, true]) {
  test(`[05] ${view} pause/resume locks a delayed request and recovers after ${fail ? 'failure' : 'success'}`, async ({ page }) => {
    const state = await uptimeFixture(page);
    const gate = deferred();
    state.holds.set('PUT /services/http-monitor', gate.promise);
    if (fail) state.failures.set('PUT /services/http-monitor', 500);
    await page.goto(`./uptime${view === 'card' ? '?view=card' : ''}`);
    const pause = page.getByRole('button', { name: 'Public API 일시정지', exact: true });
    const card = page.getByRole('row').or(page.getByRole('article')).filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) });
    try {
      await pause.click();
      await expect(pause).toBeDisabled();
      await expect(pause).toHaveAttribute('aria-busy', 'true');
      const rect = await pause.boundingBox();
      await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
      expect(state.requests.filter((item) => item.method === 'PUT')).toHaveLength(1);
      gate.resolve();
      state.holds.clear();
      if (fail) {
        await expect(pause).toBeEnabled();
        await expect(card.getByText('정상', { exact: true })).toBeVisible();
        state.failures.clear();
        await pause.click();
      }
      await expect(card.getByText('일시정지', { exact: true })).toBeVisible();
      const resume = page.getByRole('button', { name: 'Public API 재개', exact: true });
      await expect(resume).toBeEnabled();
      await resume.click();
      await expect(pause).toBeEnabled();
      await expect(card.getByText('확인 대기', { exact: true })).toBeVisible();
      const writes = state.requests.filter((item) => item.method === 'PUT');
      expect(writes[0].body).toMatchObject({ type: 'http', method: 'GET', expectedStatus: 200, isActive: false });
      expect(writes.at(-1)!.body!.isActive).toBe(true);
    } finally {
      gate.resolve();
    }
  });
}
