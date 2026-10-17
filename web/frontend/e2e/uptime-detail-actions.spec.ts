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

test('[11] deleting identifies the monitor, cancels safely, and retries a failed delayed DELETE', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./uptime/http-monitor');
  const open = page.getByRole('button', { name: '삭제', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: '업타임을 삭제할까요?' });
  await expect(dialog).toContainText('Public API');
  await expect(dialog).toContainText('체크 기록도 함께 삭제');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);
  await open.click();
  const gate = deferred();
  state.holds.set('DELETE /services/http-monitor', gate.promise);
  state.failures.set('DELETE /services/http-monitor', 500);
  const confirm = dialog.getByRole('button', { name: '삭제', exact: true });
  try {
    await confirm.click();
    await expect(confirm).toHaveAttribute('aria-busy', 'true');
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    const box = await confirm.boundingBox();
    await page.mouse.click(box!.x + 5, box!.y + 5);
    expect(state.requests.filter((request) => request.method === 'DELETE')).toHaveLength(1);
    gate.resolve(); state.holds.clear();
    await expect(confirm).toBeEnabled();
    await expect(dialog).toBeVisible();
    expect(state.monitors.some((monitor) => monitor.id === 'http-monitor')).toBe(true);
    state.failures.clear();
    await confirm.click();
    await expect(page).toHaveURL(/\/uptime$/);
    await expect(page.getByRole('link', { name: 'Public API', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Database', exact: true })).toBeVisible();
    expect(state.requests.filter((request) => request.method === 'DELETE')).toHaveLength(2);
    expect(state.monitors.some((monitor) => monitor.id === 'http-monitor')).toBe(false);
  } finally { gate.resolve(); }
});
