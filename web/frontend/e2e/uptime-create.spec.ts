import { expect, test } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { deferred, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: API_URL });

for (const [name, url] of [['   ', 'https://example.com'], ['Probe', 'not-a-url'], ['Probe', 'ftp://files.example.com']]) {
  test(`[06] HTTP rejects invalid name/URL ${name}:${url} before submission`, async ({ page }) => {
    const state = await uptimeFixture(page);
    await page.goto('./servers/server-1/uptime');
    await page.getByRole('button', { name: '모니터 추가', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '업타임 추가' });
    await dialog.getByRole('textbox', { name: '이름', exact: true }).fill(name);
    await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill(url);
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    // 브라우저 말풍선이 아니라 입력 아래의 오류다. 첫 오류 칸으로 포커스가 간다(UI/UX 점검 A5).
    const field = dialog.getByRole('textbox', { name: name.trim() ? 'URL' : '이름', exact: true });
    const message = name.trim() ? 'http:// 또는 https://로 시작하는 주소를 입력하세요' : '이름을 입력하세요';
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(message);
    expect(state.requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });
}

test('[06] HTTP fields retain drafts through a failed save and block edits while saving', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  await page.getByRole('button', { name: '모니터 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  const name = dialog.getByRole('textbox', { name: '이름', exact: true });
  const url = dialog.getByRole('textbox', { name: 'URL', exact: true });
  const interval = dialog.getByRole('spinbutton', { name: '주기 (초)', exact: true });
  const timeout = dialog.getByRole('spinbutton', { name: '타임아웃 (초)', exact: true });
  await expect(interval).toHaveValue('30');
  await expect(timeout).toHaveValue('5');
  await name.fill('HTTP Probe');
  await url.fill('https://probe.example.com/health');
  await interval.fill('');
  await expect(interval).toHaveValue('');
  await interval.fill('4');
  await timeout.fill('0');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(interval).toHaveAccessibleDescription('5초 이상의 정수를 입력하세요');
  await expect(timeout).toHaveAccessibleDescription('0.1초 이상으로 입력하세요');
  await expect(interval).toBeFocused();
  expect(state.requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  await interval.fill('60');
  await expect(interval).not.toHaveAttribute('aria-invalid', 'true');
  // 주기와 같은 초 단위로 받고, API에는 ms로 보낸다.
  await timeout.fill('2.5');
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
    // 서버 탭은 만든 모니터의 상세를 연다.
    await expect(page).toHaveURL(/\/servers\/server-1\/uptime\/created-2$/);
    await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2, name: 'HTTP Probe', exact: true })).toBeVisible();
    const writes = state.requests.filter((request) => request.method === 'POST');
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toMatchObject({ name: 'HTTP Probe', type: 'http', url: 'https://probe.example.com/health', interval: 60, timeout: 2500 });
  } finally { gate.resolve(); }
});

test('[06] cancelling an HTTP draft performs no write and reopens cleanly', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const add = page.getByRole('button', { name: '모니터 추가', exact: true });
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
  await page.goto('./servers/server-1/uptime');
  await page.getByRole('button', { name: '모니터 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  const type = dialog.getByRole('combobox');
  await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('TCP Probe');
  await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill('db.example.com');
  await type.press('ArrowDown');
  const host = dialog.getByRole('textbox', { name: '호스트', exact: true });
  const port = dialog.getByRole('spinbutton', { name: '포트', exact: true });
  await expect(host).toHaveValue('db.example.com');
  await expect(port).toHaveValue('443');
  // 검증은 입력 아래의 오류로 보인다(UI/UX 점검 A5). 빈 호스트로 제출을 막아 둔 채 포트의 경계를 확인한다.
  const save = dialog.getByRole('button', { name: '추가', exact: true });
  await host.fill('   ');
  for (const value of ['', '0', '65536', '1.5']) {
    await port.fill(value);
    await save.click();
    await expect(port).toHaveAccessibleDescription('1~65535 사이의 포트를 입력하세요');
  }
  for (const value of ['1', '65535']) {
    await port.fill(value);
    await save.click();
    await expect(port).not.toHaveAttribute('aria-invalid', 'true');
    await expect(host).toHaveAccessibleDescription('호스트를 입력하세요');
  }
  await port.fill('5432');
  await host.fill('db.example.com');
  await type.press('ArrowUp');
  await expect(port).toHaveCount(0);
  await save.click();
  await expect(dialog.getByRole('textbox', { name: 'URL', exact: true })).toHaveAccessibleDescription('http:// 또는 https://로 시작하는 주소를 입력하세요');
  expect(state.requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  await type.press('ArrowDown');
  await expect(port).toHaveValue('5432');
  await dialog.getByRole('spinbutton', { name: '주기 (초)' }).fill('5');
  await dialog.getByRole('spinbutton', { name: '타임아웃 (초)' }).fill('1');
  state.failures.set('POST /services', 500);
  await save.click();
  await expect(save).toBeEnabled();
  await expect(port).toHaveValue('5432');
  await expect(host).toHaveValue('db.example.com');
  state.failures.clear();
  await save.click();
  await expect(dialog).toHaveCount(0);
  // 서버 탭은 만든 모니터의 상세를 연다. 목록의 표시는 목록으로 돌아가서 확인한다.
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime\/created-2$/);
  await page.getByRole('group', { name: '탭 조작' }).getByRole('link', { name: '모니터 목록', exact: true }).click();
  const gridRow = page.getByRole('table', { name: '업타임 그리드' }).getByRole('row').filter({ has: page.getByRole('link', { name: 'TCP Probe', exact: true }) });
  await expect(gridRow.getByText('db.example.com:5432', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole('group', { name: '대상 보기 방식' }).getByRole('button', { name: '카드', exact: true }).click();
  const card = page.locator('article').filter({ has: page.getByRole('link', { name: 'TCP Probe', exact: true }) });
  await expect(card.getByText('db.example.com:5432', { exact: true })).toBeVisible();
  const writes = state.requests.filter((request) => request.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(writes[1].body).toEqual({ name: 'TCP Probe', type: 'tcp', host: 'db.example.com', port: 5432, interval: 5, timeout: 1000, serverId: 'server-1' });
});
