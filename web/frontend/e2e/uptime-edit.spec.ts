import { expect, test } from '@playwright/test';
import { deferred, monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

for (const type of ['http', 'tcp'] as const) {
  test(`[08] ${type} edit preserves hidden settings and recovers from failed saves`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.monitors = [monitor('custom', { name: 'Custom', type, url: type === 'http' ? 'https://custom.example.com' : 'custom.example.com', port: type === 'tcp' ? 6443 : undefined, method: 'HEAD', expectedStatus: 204, isActive: false, status: 'unknown', interval: 45, timeout: 3200 })];
    await page.goto('./uptime/custom');
    await page.getByRole('button', { name: '수정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '업타임 수정' });
    const name = dialog.getByRole('textbox', { name: '이름', exact: true });
    await expect(name).toHaveValue('Custom');
    await expect(dialog.getByRole('combobox')).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: type === 'http' ? 'URL' : '호스트', exact: true })).toHaveValue(state.monitors[0].url);
    if (type === 'tcp') await expect(dialog.getByRole('spinbutton', { name: '포트', exact: true })).toHaveValue('6443');
    await expect(dialog.getByRole('spinbutton', { name: '주기 (초)' })).toHaveValue('45');
    await expect(dialog.getByRole('spinbutton', { name: '타임아웃 (초)' })).toHaveValue('3.2');
    await name.fill('Discard');
    await dialog.getByRole('button', { name: '취소' }).click();
    expect(state.requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
    await page.getByRole('button', { name: '수정', exact: true }).click();
    await expect(name).toHaveValue('Custom');
    await name.fill('Renamed');
    const gate = deferred();
    state.holds.set('PUT /services/custom', gate.promise);
    state.failures.set('PUT /services/custom', 500);
    const save = dialog.getByRole('button', { name: '저장', exact: true });
    try {
      await save.click();
      await expect(save).toHaveAttribute('aria-busy', 'true');
      await expect(name).toBeDisabled();
      gate.resolve(); state.holds.clear();
      await expect(save).toBeEnabled();
      await expect(name).toHaveValue('Renamed');
      await expect(page.getByRole('heading', { name: 'Custom', exact: true })).toBeVisible();
      state.failures.clear();
      await save.click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Renamed', exact: true })).toBeVisible();
      const writes = state.requests.filter((request) => request.method === 'PUT');
      expect(writes).toHaveLength(2);
      expect(writes[1].body).toMatchObject({ name: 'Renamed', type, interval: 45, timeout: 3200, method: 'HEAD', expectedStatus: 204, isActive: false });
      expect(writes[1].body).toMatchObject(type === 'http' ? { url: 'https://custom.example.com' } : { host: 'custom.example.com', port: 6443 });
    } finally { gate.resolve(); }
  });
}
