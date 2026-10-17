import { expect, test } from '@playwright/test';
import { deferred, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('[10] detail pause/resume blocks competing controls and recovers from failure', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./uptime/http-monitor');
  const pause = page.getByRole('button', { name: '일시정지', exact: true });
  await expect(pause).toBeEnabled();
  const gate = deferred();
  state.holds.set('PUT /services/http-monitor', gate.promise);
  state.failures.set('PUT /services/http-monitor', 500);
  try {
    await pause.click();
    await expect(pause).toHaveAttribute('aria-busy', 'true');
    for (const name of ['일시정지', '수정', '삭제', '새로고침']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
    const box = await pause.boundingBox();
    await page.mouse.click(box!.x + 5, box!.y + 5);
    expect(state.requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    gate.resolve(); state.holds.clear();
    await expect(pause).toBeEnabled();
    await expect(page.getByText('정상', { exact: true })).toBeVisible();
    state.failures.clear();
    await pause.click();
    await expect(page.getByRole('button', { name: '재개', exact: true })).toBeEnabled();
    await expect(page.getByText('일시정지', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '재개', exact: true }).click();
    await expect(pause).toBeEnabled();
    const writes = state.requests.filter((request) => request.method === 'PUT');
    expect(writes).toHaveLength(3);
    expect(writes[1].body).toMatchObject({ isActive: false, method: 'GET', expectedStatus: 200, url: 'https://api.example.com/health' });
    expect(writes[2].body).toMatchObject({ isActive: true });
  } finally { gate.resolve(); }
});
