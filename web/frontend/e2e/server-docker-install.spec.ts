import { expect, test } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { uptimeFixture } from './fixtures/uptime';

// Docker Collector 설치(통합 3단계, ADR 0012): 기존 서버에 설치하고, 서버당 호스트 지표 출처는 하나다. 서버 구성은 src/mocks/SCENARIOS.md.
const connectable = (page: import('@playwright/test').Page) => page.getByRole('region', { name: '연결할 수 있는 기능' });

test('an existing server installs a Docker Collector from its overview', async ({ page }) => {
  await page.goto('./servers/server_mock_staging_empty');
  await page.getByRole('button', { name: 'Docker Collector 설치', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Docker Collector 설치' });
  await expect(dialog).toContainText('서버 staging-empty에 Docker Collector를 설치합니다.');
  // 이 서버에는 OpenTelemetry Collector 인프라가 없어 고를 출처가 없다.
  await expect(dialog.getByRole('group', { name: '호스트 지표 출처' })).toHaveCount(0);
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '설치 명령 복사' })).toBeVisible();
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  // 같은 서버가 Docker Collector를 갖는다. 새 서버를 만들지 않는다.
  await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^컨테이너/ })).toBeVisible();
  await expect(connectable(page).getByRole('button', { name: 'Docker Collector 설치' })).toHaveCount(0);
});

test('installing on a server with an OpenTelemetry Collector asks which host metrics to keep', async ({ page }) => {
  // batch-host-01은 OpenTelemetry Collector로 호스트 지표를 받는다.
  await page.goto('./servers/server_mock_batch_host_01');
  await connectable(page).getByRole('button', { name: 'Docker Collector 설치' }).click();
  const dialog = page.getByRole('dialog', { name: 'Docker Collector 설치' });
  const source = dialog.getByRole('group', { name: '호스트 지표 출처' });
  await expect(source).toBeVisible();
  const add = dialog.getByRole('button', { name: '추가', exact: true });
  await expect(add).toBeDisabled();
  // 기본 수집은 호스트 지표를 모으지 않아 고를 것이 없다.
  await dialog.getByRole('button', { name: '기본', exact: true }).click();
  await expect(source).toHaveCount(0);
  await dialog.getByRole('button', { name: '전체', exact: true }).click();
  await source.getByRole('radio', { name: /^OpenTelemetry Collector/ }).check();
  await add.click();
  await expect(dialog.getByRole('button', { name: '설치 명령 복사' })).toBeVisible();
});

test('server adding with Docker Collector chosen continues to the install on the new server', async ({ page }) => {
  await page.goto('./servers/new');
  await page.getByRole('textbox', { name: '이름' }).fill('cache-01');
  await page.getByRole('radio', { name: /^Docker Collector 설치/ }).check();
  await page.getByRole('button', { name: '서버 추가', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'cache-01' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Docker Collector 설치' })).toContainText('서버 cache-01에 Docker Collector를 설치합니다.');
});

test.describe('against the API', () => {
  test.use({ baseURL: API_URL });

  test('connecting an OpenTelemetry Collector to a Docker server that collects host metrics chooses one source', async ({ page }) => {
    const state = await uptimeFixture(page);
    await page.goto('./servers/docker-host/infrastructure');
    await page.getByRole('tabpanel').getByRole('button', { name: '인프라 연결', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '인프라 연결' });
    const submit = dialog.getByRole('button', { name: '연결', exact: true });
    await expect(submit).toBeDisabled();
    // Docker Collector를 남기면 아무것도 만들지 않고 닫는다.
    await dialog.getByRole('radio', { name: /^Docker Collector/ }).check();
    await dialog.getByRole('button', { name: 'Docker Collector 유지' }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.requests.some((request) => request.method === 'POST' && request.path === '/infrastructure-resources')).toBe(false);

    await page.getByRole('tabpanel').getByRole('button', { name: '인프라 연결', exact: true }).click();
    await dialog.getByRole('radio', { name: /^OpenTelemetry Collector/ }).check();
    await dialog.getByRole('button', { name: '연결', exact: true }).click();
    await expect.poll(() => state.requests.find((request) => request.method === 'POST' && request.path === '/infrastructure-resources')?.body)
      .toMatchObject({ serverId: 'docker-host', infrastructure: 'otel' });
  });

  test('adding host metrics to a Docker Collector next to an OpenTelemetry Collector switches the source', async ({ page }) => {
    const state = await uptimeFixture(page);
    const at = new Date().toISOString();
    state.responses.set('GET /agents', [{ id: 'docker-host', name: 'Production Docker', serverId: 'docker-host', version: '0.3.0', lastSeenAt: at, createdAt: at, updatedAt: at, profile: { kind: 'basic', capabilities: ['uptime', 'logs'] } }]);
    state.responses.set('GET /infrastructure-resources', [{ id: 'otel-1', name: 'Production Docker', serverId: 'docker-host', adapter: 'otel-collector', isActive: true, lastSeenAt: at, createdAt: at, updatedAt: at }]);
    state.responses.set('GET /agents/docker-host/setup-status', { connected: true, configApplied: true, profile: { kind: 'basic', capabilities: ['uptime', 'logs'] }, signals: [] });
    await page.goto('./servers/docker-host');
    await page.getByRole('button', { name: '인프라 연결', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: '인프라 연결' });
    await expect(dialog).toContainText('OpenTelemetry Collector 연결을 중지합니다');
    await dialog.getByRole('button', { name: 'Docker Collector로 바꾸고 적용 명령 받기' }).click();
    await expect.poll(() => state.requests.find((request) => request.method === 'PUT' && request.path === '/agents/docker-host/profile')?.query).toBe('?infrastructure=docker');
  });
});
