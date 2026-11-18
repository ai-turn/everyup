import { expect, test } from '@playwright/test';
import { deferred, monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });
const panel = (page: import('@playwright/test').Page) => page.getByRole('tabpanel');

test('[10] detail pause/resume blocks competing controls and recovers from failure', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime/http-monitor');
  const pause = page.getByRole('button', { name: '일시정지', exact: true });
  await expect(pause).toBeEnabled();
  const gate = deferred();
  state.holds.set('PUT /services/http-monitor', gate.promise);
  state.failures.set('PUT /services/http-monitor', 500);
  try {
    await pause.click();
    await expect(pause).toHaveAttribute('aria-busy', 'true');
    for (const name of ['일시정지', '수정', '삭제']) await expect(panel(page).getByRole('button', { name, exact: true })).toBeDisabled();
    // 새로고침은 서버 머리말에 하나다. 일시정지 요청이 진행 중인 동안 머리말의 새로고침을 눌러도
    // 패널은 그 모니터를 다시 불러오지 않는다(변경 전의 응답이 변경 뒤의 화면을 덮지 않게).
    const detailReads = () => state.requests.filter((request) => request.method === 'GET' && request.path === '/services/http-monitor').length;
    const serverReads = () => state.requests.filter((request) => request.method === 'GET' && request.path === '/servers').length;
    const before = { detail: detailReads(), servers: serverReads() };
    const refresh = page.getByRole('button', { name: '새로고침', exact: true });
    await refresh.click();
    await expect.poll(serverReads).toBe(before.servers + 1);
    await expect(refresh).toBeEnabled();
    expect(detailReads()).toBe(before.detail);
    const box = await pause.boundingBox();
    await page.mouse.click(box!.x + 5, box!.y + 5);
    expect(state.requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    gate.resolve(); state.holds.clear();
    await expect(pause).toBeEnabled();
    await expect(panel(page).getByText('정상', { exact: true })).toBeVisible();
    state.failures.clear();
    await pause.click();
    await expect(page.getByRole('button', { name: '재개', exact: true })).toBeEnabled();
    await expect(panel(page).getByText('일시정지', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '재개', exact: true }).click();
    await expect(pause).toBeEnabled();
    const writes = state.requests.filter((request) => request.method === 'PUT');
    expect(writes).toHaveLength(3);
    const sent = { name: 'Public API', serverId: 'server-1', type: 'http', url: 'https://api.example.com/health', method: 'GET', expectedStatus: 200, timeout: 5000, interval: 30 };
    expect(writes[1].body).toEqual({ ...sent, isActive: false });
    expect(writes[2].body).toEqual({ ...sent, isActive: true });
  } finally { gate.resolve(); }
});

test('[11] deleting identifies the monitor, cancels safely, and retries a failed delayed DELETE', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime/http-monitor');
  const open = page.getByRole('button', { name: '삭제', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: '업타임을 삭제할까요?' });
  await expect(dialog).toContainText('Public API');
  await expect(dialog).toContainText('체크 기록');
  await expect(dialog).toContainText('알림 규칙도 함께 삭제');
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
    await expect(page).toHaveURL(/\/servers\/server-1\/uptime$/);
    // 남은 모니터가 하나라서 탭의 첫 화면은 그 모니터의 상세다.
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Database', exact: true })).toBeVisible();
    await expect(panel(page)).not.toContainText('Public API');
    expect(state.requests.filter((request) => request.method === 'DELETE')).toHaveLength(2);
    expect(state.monitors.some((monitor) => monitor.id === 'http-monitor')).toBe(false);
  } finally { gate.resolve(); }
});

test('pause and edit are built from the monitor as it is now, not as the panel last loaded it', async ({ page }) => {
  const state = await uptimeFixture(page);
  const puts = () => state.requests.filter((request) => request.method === 'PUT');
  const moved = monitor('http-monitor', { serverId: 'server-2', timeout: 9000 });
  await page.goto('./servers/server-1/uptime/http-monitor');
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();

  // 다른 창에서 이 모니터를 다른 서버로 옮기고 타임아웃을 바꿨다. 패널은 아직 다시 불러오지 않았다.
  state.responses.set('GET /services/http-monitor', moved);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 수정' });
  await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('Renamed');
  await dialog.getByRole('spinbutton', { name: '주기 (초)' }).fill('60');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // 사용자가 입력한 값(이름, 주기, 대화 상자의 타임아웃)이 다시 읽은 값 위에 덮인다. 서버는 다시 읽은 값이다.
  expect(puts()[0].body).toEqual({
    name: 'Renamed', serverId: 'server-2', type: 'http', url: 'https://api.example.com/health', method: 'GET', expectedStatus: 200, timeout: 5000, interval: 60, isActive: true,
  });

  state.monitors = state.monitors.map((item) => item.id === 'http-monitor' ? monitor('http-monitor') : item);
  state.responses.clear();
  await page.goto('./servers/server-1/uptime/http-monitor');
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
  state.responses.set('GET /services/http-monitor', moved);
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect.poll(() => puts().length).toBe(2);
  expect(puts()[1].body).toEqual({
    name: 'Public API', serverId: 'server-2', type: 'http', url: 'https://api.example.com/health', method: 'GET', expectedStatus: 200, timeout: 9000, interval: 30, isActive: false,
  });

  // 이미 지워졌으면 요청을 보내지 않고 알린다.
  state.responses.clear();
  state.monitors = state.monitors.map((item) => item.id === 'http-monitor' ? monitor('http-monitor') : item);
  await page.goto('./servers/server-1/uptime/http-monitor');
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
  state.failures.set('GET /services/http-monitor', 404);
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect(page.getByText('대상이 삭제되어 일시정지할 수 없습니다')).toBeVisible();
  expect(puts()).toHaveLength(2);
});
