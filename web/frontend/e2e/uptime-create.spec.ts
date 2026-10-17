import { expect, test } from '@playwright/test';
import { deferred, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

for (const [name, url] of [['   ', 'https://example.com'], ['Probe', 'not-a-url'], ['Probe', 'ftp://files.example.com']]) {
  test(`[06] HTTP rejects invalid name/URL ${name}:${url} before submission`, async ({ page }) => {
    const state = await uptimeFixture(page);
    await page.goto('./uptime');
    await page.getByRole('button', { name: '추가', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '업타임 추가' });
    await dialog.getByRole('textbox', { name: '이름', exact: true }).fill(name);
    await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill(url);
    expect(await dialog.locator('form').evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(false);
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    expect(state.requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });
}

test('[06] HTTP fields retain drafts through a failed save and block edits while saving', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./uptime');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  const name = dialog.getByRole('textbox', { name: '이름', exact: true });
  const url = dialog.getByRole('textbox', { name: 'URL', exact: true });
  const interval = dialog.getByRole('spinbutton', { name: '주기 (초)', exact: true });
  const timeout = dialog.getByRole('spinbutton', { name: '타임아웃 (ms)', exact: true });
  await expect(interval).toHaveValue('30');
  await expect(timeout).toHaveValue('5000');
  await name.fill('HTTP Probe');
  await url.fill('https://probe.example.com/health');
  await interval.fill('');
  await expect(interval).toHaveValue('');
  await interval.fill('4');
  expect(await interval.evaluate((element: HTMLInputElement) => element.validity.rangeUnderflow)).toBe(true);
  await interval.fill('60');
  await timeout.fill('0');
  expect(await timeout.evaluate((element: HTMLInputElement) => element.validity.rangeUnderflow)).toBe(true);
  await timeout.fill('2500');
  const gate = deferred();
  state.holds.set('POST /services', gate.promise);
  state.failures.set('POST /services', 500);
  const save = dialog.getByRole('button', { name: '추가', exact: true });
  try {
    await save.click();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute('aria-busy', 'true');
    await expect(name).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    gate.resolve();
    state.holds.clear();
    await expect(save).toBeEnabled();
    await expect(name).toHaveValue('HTTP Probe');
    await expect(url).toHaveValue('https://probe.example.com/health');
    state.failures.clear();
    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'HTTP Probe', exact: true })).toBeVisible();
    const writes = state.requests.filter((request) => request.method === 'POST');
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toMatchObject({ name: 'HTTP Probe', type: 'http', url: 'https://probe.example.com/health', interval: 60, timeout: 2500 });
  } finally { gate.resolve(); }
});

test('[06] cancelling an HTTP draft performs no write and reopens cleanly', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./uptime');
  const add = page.getByRole('button', { name: '추가', exact: true });
  await add.click();
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('discard');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await add.click();
  await expect(dialog.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(state.requests.filter((request) => request.method === 'POST')).toHaveLength(0);
});

test('[07] switching HTTP/TCP preserves drafts, validates boundaries and saves TCP after failure', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./uptime');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  const type = dialog.getByRole('combobox');
  await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('TCP Probe');
  await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill('db.example.com');
  await type.press('ArrowDown');
  const host = dialog.getByRole('textbox', { name: '호스트', exact: true });
  const port = dialog.getByRole('spinbutton', { name: '포트', exact: true });
  await expect(host).toHaveValue('db.example.com');
  await expect(port).toHaveValue('443');
  for (const value of ['', '0', '65536', '1.5']) {
    await port.fill(value);
    expect(await dialog.locator('form').evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(false);
  }
  for (const value of ['1', '65535']) {
    await port.fill(value);
    expect(await dialog.locator('form').evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(true);
  }
  await port.fill('5432');
  await host.fill('   ');
  expect(await dialog.locator('form').evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(false);
  await host.fill('db.example.com');
  await type.press('ArrowUp');
  await expect(port).toHaveCount(0);
  expect(await dialog.locator('form').evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(false);
  await type.press('ArrowDown');
  await expect(port).toHaveValue('5432');
  await dialog.getByRole('spinbutton', { name: '주기 (초)' }).fill('5');
  await dialog.getByRole('spinbutton', { name: '타임아웃 (ms)' }).fill('1');
  state.failures.set('POST /services', 500);
  const save = dialog.getByRole('button', { name: '추가', exact: true });
  await save.click();
  await expect(save).toBeEnabled();
  await expect(port).toHaveValue('5432');
  await expect(host).toHaveValue('db.example.com');
  state.failures.clear();
  await save.click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('article').filter({ has: page.getByRole('link', { name: 'TCP Probe', exact: true }) });
  await expect(card.getByText('db.example.com:5432', { exact: true })).toBeVisible();
  const writes = state.requests.filter((request) => request.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(writes[1].body).toEqual({ name: 'TCP Probe', type: 'tcp', host: 'db.example.com', port: 5432, interval: 5, timeout: 1 });
});
