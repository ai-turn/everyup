import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { uptimeFixture } from './fixtures/uptime';

// 같은 호스트 합치기(ADR 0012, 통합 3단계): Docker 서버도 다른 서버에 합친다. Docker Collector는 서버에 하나이고,
// 호스트 지표를 두 번 모으게 되면 출처를 하나 고른다. 서버 구성은 src/mocks/SCENARIOS.md.
// mock은 쓰기를 메모리에 반영하지만 page.goto는 그 메모리를 버린다. 변경 뒤에는 앱 안에서 이동한다.
const header = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });

async function openMerge(page: Page) {
  await header(page).getByRole('button', { name: '서버 설정' }).click();
  await page.getByRole('dialog', { name: '서버 설정' }).getByRole('button', { name: '다른 서버 합치기' }).click();
  return page.getByRole('dialog', { name: '다른 서버 합치기' });
}

// 앱 안에서 주소를 바꾼다(뒤로 가기·링크와 같은 경로). mock의 변경이 남는다.
async function goWithinApp(page: Page, path: string) {
  await page.evaluate((to) => {
    window.history.pushState(null, '', `${window.location.pathname.replace(/\/servers.*$/, '')}${to}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('a Docker server merges into a direct server, and its old address follows it', async ({ page }) => {
  await page.goto('./servers/server_mock_staging_empty');
  const merge = await openMerge(page);
  const edgeNode = merge.getByRole('checkbox', { name: /^edge-node/ });
  await expect(edgeNode).toHaveAccessibleName(/Docker Collector/);
  await edgeNode.check();
  // 서버에 Docker Collector는 하나다. 다른 Docker 서버는 고를 수 없다.
  const prodServer = merge.getByRole('checkbox', { name: /^prod-server/ });
  await expect(prodServer).toBeDisabled();
  await expect(prodServer).toHaveAccessibleName(/Docker Collector가 이미 있습니다/);
  // staging-empty에는 인프라 리소스가 없어 고를 출처가 없다.
  await expect(merge.getByRole('group', { name: '호스트 지표 출처' })).toHaveCount(0);
  await merge.getByRole('button', { name: '합치기' }).click();
  await expect(merge).toHaveCount(0);

  // 합친 서버는 Docker Collector와 컨테이너를 가진다.
  await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^컨테이너/ })).toBeVisible();
  // 합쳐서 사라진 Docker 서버의 주소(탭 포함)는 합친 서버로 간다.
  await goWithinApp(page, '/servers/agent_demo_04/logs?range=24h');
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_empty\/logs\?range=24h$/);
  await expect(page.getByRole('heading', { level: 1, name: 'staging-empty' })).toBeVisible();
});

test('merging a Docker server next to an OpenTelemetry Collector asks which host metrics to keep', async ({ page }) => {
  // batch-host-01에는 OpenTelemetry Collector 리소스가 있고, worker-cluster의 Docker Collector는 인프라를 모은다.
  await page.goto('./servers/server_mock_batch_host_01');
  const merge = await openMerge(page);
  await merge.getByRole('checkbox', { name: /^worker-cluster/ }).check();
  const source = merge.getByRole('group', { name: '호스트 지표 출처' });
  await expect(source).toBeVisible();
  const submit = merge.getByRole('button', { name: '합치기' });
  await expect(submit).toBeDisabled();
  await source.getByRole('radio', { name: /^OpenTelemetry Collector/ }).check();
  await submit.click();
  // Docker Collector의 수집에서 인프라를 뺐으니 서버에서 실행할 적용 명령을 연다.
  await expect(page.getByRole('dialog', { name: '적용 명령' })).toBeVisible();
});

test('a Docker server cannot take another Docker server', async ({ page }) => {
  await page.goto('./servers/agent_demo_01');
  const merge = await openMerge(page);
  await expect(merge.getByRole('checkbox', { name: /^edge-node/ })).toBeDisabled();
  await expect(merge.getByRole('checkbox', { name: /^staging-empty/ })).toBeEnabled();
  // 삭제는 Docker Collector 비활성화로 한다.
  await page.keyboard.press('Escape');
});

test.describe('against the API', () => {
  test.use({ baseURL: API_URL });

  test('the overview suggests merging a Docker server with the server of the same name, and remembers "not the same"', async ({ page }) => {
    const state = await uptimeFixture(page);
    // 이름 충돌로 접미사가 붙은 Docker 서버(migrateV59)와 직접 연결 서버 web-01.
    state.dockerServer = { ...state.dockerServer!, name: 'web-01 (2)' };
    await page.goto('./');
    const suggestion = page.getByRole('region', { name: '같은 호스트로 보이는 서버' });
    await expect(suggestion).toContainText('web-01 (2)');
    await suggestion.getByRole('button', { name: '합치기: web-01 (2) → web-01' }).click();
    await expect(page).toHaveURL(/\/servers\/server-1$/);
    const merge = page.getByRole('dialog', { name: '다른 서버 합치기' });
    await expect(merge.getByRole('checkbox', { name: /^web-01 \(2\)/ })).toBeChecked();
    await merge.getByRole('button', { name: '합치기' }).click();
    await expect.poll(() => state.requests.find((request) => request.method === 'POST' && request.path === '/servers/docker-host/merge')?.body)
      .toEqual({ targetServerId: 'server-1' });

    await page.goto('./');
    await suggestion.getByRole('button', { name: '다른 호스트: web-01 (2), web-01' }).click();
    await expect(suggestion).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: '현재 확인 필요' })).toBeVisible();
    await expect(suggestion).toHaveCount(0);
  });
});
