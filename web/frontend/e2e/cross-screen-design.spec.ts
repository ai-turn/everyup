import { expect, test, type Locator, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { mockRouter } from '../src/services/mockRouter';
import type { AgentServiceFlat, ConnectedAgent, InfrastructureResource, Project, Server } from '../src/services/api';
import { uptimeFixture } from './fixtures/uptime';

// 전환 후 화면의 디자인 수정(Task 14b). 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표(attention 시나리오)를 따른다.
const EDGE = 'server_mock_edge_host_01';
const attention = (page: Page) => page.getByRole('region', { name: '현재 확인 필요' });
const outages = (page: Page) => attention(page).getByRole('group', { name: '장애', exact: true });
const warnings = (page: Page) => attention(page).getByRole('group', { name: '확인 필요', exact: true });
const panel = (page: Page) => page.getByRole('tabpanel');

/** 확인 필요 행의 종류 순서: 0 수집이 끊겼거나 수신 전, 1 메트릭 임계값 초과, 2 리소스 사용률. */
const warnRank = (text: string) => (/기준 \d+%/.test(text) ? 2 : text.includes('임계값 초과') ? 1 : 0);

/** 보이는 확인 필요 행을 세고, 종류의 순서대로인지 본다. */
async function expectWarnRows(page: Page, count: number) {
  const rows = warnings(page).getByRole('listitem');
  await expect(rows).toHaveCount(count);
  const ranks = (await rows.allInnerTexts()).map(warnRank);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  return rows;
}

/**
 * 키보드 포커스의 링(2px + 2px)이 잘리지 않는다: 요소의 사각형을 outline-width + outline-offset만큼 넓힌 영역이
 * 화면과 잘라 내는 모든 조상(overflow가 visible이 아닌 것)의 보이는 영역 안에 있다.
 */
async function expectRingVisible(page: Page, target: Locator) {
  await page.keyboard.press('Tab');
  await target.focus();
  const result = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    const pad = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    const rect = element.getBoundingClientRect();
    const ring = { left: rect.left - pad, top: rect.top - pad, right: rect.right + pad, bottom: rect.bottom + pad };
    const clips = [{ name: 'viewport', left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent);
      if (parentStyle.overflowX === 'visible' && parentStyle.overflowY === 'visible') continue;
      const box = parent.getBoundingClientRect();
      const left = box.left + parent.clientLeft;
      const top = box.top + parent.clientTop;
      clips.push({ name: `${parent.tagName}.${parent.className}`.slice(0, 60), left, top, right: left + parent.clientWidth, bottom: top + parent.clientHeight });
    }
    return {
      focused: document.activeElement === element && element.matches(':focus-visible'),
      pad,
      clipped: clips.filter((clip) => ring.left < clip.left - 0.5 || ring.top < clip.top - 0.5 || ring.right > clip.right + 0.5 || ring.bottom > clip.bottom + 0.5).map((clip) => clip.name),
    };
  });
  expect(result.focused).toBe(true);
  expect(result.pad).toBeGreaterThanOrEqual(4);
  expect(result.clipped).toEqual([]);
}

/** 문서의 제목 단계. h1이 하나이고 단계를 건너뛰지 않는다. */
async function expectHeadingOutline(scope: Locator) {
  const levels = await scope.locator('h1, h2, h3, h4, h5, h6').evaluateAll((items) => items.map((item) => Number(item.tagName[1])));
  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);
  levels.forEach((level, index) => { if (index > 0) expect(level).toBeLessThanOrEqual(levels[index - 1] + 1); });
}

test.describe('demo', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1000 }); });

  test('the overview splits outages from warnings and counts outages like the sidebar badge', async ({ page }) => {
    const payment = mockRouter<AgentServiceFlat[]>('/agents/services/all').find((service) => service.name === 'payment-worker')!;
    await page.goto('./');
    await expect(attention(page).getByText('장애 2', { exact: true })).toBeVisible();
    await expect(attention(page).getByText('확인 필요 4', { exact: true })).toBeVisible();
    // 사이드바의 배지와 같은 수다(링크 이름은 "개요 장애 2건").
    await expect(page.locator('aside').getByRole('link', { name: /^개요/ })).toHaveAccessibleName(/^개요 장애 2\s*건$/);

    await expect(outages(page).getByRole('heading', { level: 3, name: '장애' })).toBeVisible();
    await expect(outages(page).getByRole('listitem')).toHaveCount(2);
    await expect(outages(page).getByRole('link', { name: new RegExp(`^${payment.agentName} / payment-worker`) })).toBeVisible();
    await expect(outages(page).getByRole('link', { name: /^edge-host-01 \/ Checkout API/ })).toBeVisible();

    // 확인 필요는 세 건까지 보이고 나머지는 제자리에서 펼친다. 메트릭 임계값 초과가 사용률 경고보다 먼저다.
    await expect(warnings(page).getByRole('heading', { level: 3, name: '확인 필요' })).toBeVisible();
    const preview = await expectWarnRows(page, 3);
    await expect(preview.first()).toContainText('임계값 초과');
    await expect(warnings(page).getByRole('link', { name: /모두 보기/ })).toHaveCount(0);
    const more = warnings(page).getByRole('button', { name: '확인 필요 4건 모두 보기' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(warnings(page).getByRole('button', { name: '우선 항목만 보기' })).toHaveAttribute('aria-expanded', 'true');
    await expectWarnRows(page, 4);
    const usage = warnings(page).getByRole('link', { name: /db-primary-01/ }).filter({ hasText: '메모리 84.6%' });
    await expect(usage).toContainText('메모리 84.6%, 기준 70%');
    // 사용률 경고는 늘 방금 받은 값이라 수신 시각 대신 기준을 적는다.
    for (const text of await warnings(page).getByRole('listitem').filter({ hasText: /기준 \d+%/ }).allInnerTexts()) expect(text).not.toContain('마지막 수신');

    // 전체 로그는 범위 줄로 옮겼다.
    await expect(attention(page).getByRole('link', { name: '전체 로그' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '모니터링 범위' }).getByRole('link', { name: '전체 로그', exact: true })).toHaveAttribute('href', /\/logs$/);

    // 최근 장애 이력의 행에도 부모(서버, Docker 환경)의 이름이 있다.
    const history = page.getByRole('region', { name: '최근 장애 이력' });
    await expect(history.getByRole('link', { name: /^edge-host-01 \/ Checkout API/ })).toBeVisible();
    await expect(history.getByRole('link', { name: new RegExp(`^${payment.agentName} / payment-worker`) })).toBeVisible();
  });

  test('the server logs tab and the more page lead to all logs, and an app opened there returns to it', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs`);
    await panel(page).getByRole('link', { name: '모든 서버의 로그', exact: true }).click();
    await expect(page).toHaveURL(/\/logs$/);
    // 직접 연결한 앱만 나온다. Docker 환경이 있으면 끝에 그 로그의 자리를 알린다.
    await expect(page.getByText('Docker 서비스의 로그는 Docker 환경에 있습니다.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Docker 환경', exact: true })).toHaveAttribute('href', /\/environments$/);

    // 앱은 자기 페이지가 있다. 좁은 화면의 복귀 링크는 앱을 연 목록이다(넓은 화면은 크럼과 뒤로 가기, Docker 서비스 상세와 같다).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('table', { name: '앱 그리드' }).locator('a[data-row-link]').first().click();
    await expect(page).toHaveURL(/\/servers\/[^/]+\/apps\/[^/?]+\?tab=logs/);
    const header = page.locator('#main-content header').first();
    await expect(header.getByRole('link', { name: '앱 목록', exact: true })).toHaveCount(0);
    await header.getByRole('link', { name: '전체 로그', exact: true }).click();
    await expect(page).toHaveURL(/\/logs$/);

    // 서버의 로그 탭에서 연 앱은 그 서버의 앱 목록으로 돌아간다.
    await page.goto(`./servers/${EDGE}/logs`);
    await page.getByRole('table', { name: '앱 그리드' }).locator('a[data-row-link]').first().click();
    await expect(header.getByRole('link', { name: '앱 목록', exact: true })).toBeVisible();

    await page.goto('./more');
    await page.getByRole('link', { name: /^전체 로그/ }).click();
    await expect(page).toHaveURL(/\/logs$/);
  });

  test('the first button of an empty server opens the monitor dialog once', async ({ page }) => {
    await page.goto('./servers/server_mock_staging_empty');
    await expect(panel(page).getByRole('button')).toHaveCount(1);
    await expect(panel(page)).toContainText('다른 기능은 각 탭에서 연결합니다.');
    await panel(page).getByRole('button', { name: '업타임 모니터 추가', exact: true }).click();
    await expect(page).toHaveURL(/\/servers\/server_mock_staging_empty\/uptime$/);
    const dialog = page.getByRole('dialog', { name: '업타임 추가' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(panel(page).getByText('이 서버의 업타임 모니터를 추가하세요', { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  test('the palette finds monitors, apps and groups', async ({ page }) => {
    await page.goto('./');
    const open = page.locator('aside').getByRole('button', { name: /^검색/ });
    await open.click();
    const palette = page.getByRole('dialog', { name: '검색' });
    await palette.getByRole('textbox', { name: '검색' }).fill('Checkout');
    const monitor = palette.getByRole('option', { name: /^Checkout API/ });
    await expect(monitor).toContainText('edge-host-01의 모니터');
    await monitor.click();
    await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/monitors/uptime_mock_checkout$`));

    const group = mockRouter<Project[]>('/projects')[0];
    await open.click();
    await palette.getByRole('textbox', { name: '검색' }).fill(group.name);
    await palette.getByRole('option', { name: new RegExp(`^${group.name}`) }).filter({ hasText: '그룹' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${group.id}$`));
  });

  test('a group says which Docker environment a Docker service belongs to', async ({ page }) => {
    const agents = mockRouter<ConnectedAgent[]>('/agents');
    const down = mockRouter<AgentServiceFlat[]>('/agents/services/all').find((service) => !service.healthy && agents.find((agent) => agent.id === service.agentId)?.projectId)!;
    const projectId = agents.find((agent) => agent.id === down.agentId)!.projectId!;
    await page.goto(`./projects/${projectId}`);
    const row = page.getByRole('table', { name: '그룹 구성 그리드' }).locator('tbody tr').filter({ hasText: down.name });
    await expect(row).toContainText(`${down.agentName}의 Docker 서비스`);
  });

  test('screens that are a single notice or a form keep one h1 and do not skip levels', async ({ page }) => {
    await page.goto('./servers/no-such-server');
    await expect(page.getByRole('heading', { level: 1, name: '서버를 찾을 수 없습니다' })).toBeVisible();
    await expectHeadingOutline(page.locator('body'));

    await page.goto('./uptime/no-such-monitor');
    await expect(page.getByRole('heading', { level: 1, name: '업타임 모니터를 찾을 수 없습니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: '개요에서 현재 장애 보기' })).toBeVisible();
    await expectHeadingOutline(page.locator('body'));

    await page.goto('./alerts?tab=rules');
    await page.getByRole('button', { name: '규칙 추가' }).click();
    const form = page.getByRole('dialog', { name: '새 알림 규칙' });
    await expect(form.getByRole('heading', { level: 2, name: '새 알림 규칙' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    await page.goto('./');
    await page.getByRole('combobox', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: '첫 시작', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: '아직 모니터링 대상이 없습니다' })).toBeVisible();
    await expectHeadingOutline(page.locator('body'));
  });

  test('the alert target picker groups Docker environments and servers', async ({ page }) => {
    await page.goto('./alerts?tab=rules');
    await page.getByRole('button', { name: '규칙 추가' }).click();
    await page.getByRole('combobox', { name: '대상' }).click();
    const listbox = page.getByRole('listbox');
    await expect(listbox.getByRole('group', { name: 'Docker 환경' })).toBeVisible();
    const servers = listbox.getByRole('group', { name: '서버' });
    await expect(servers.getByRole('option', { name: 'edge-host-01 / Checkout API' })).toBeVisible();
    const labels = await servers.getByRole('option').allInnerTexts();
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'ko')));
  });

  test('focus rings of the logo and the first sidebar item are not clipped', async ({ page }) => {
    await page.goto('./servers');
    await expectRingVisible(page, page.locator('aside').getByRole('link', { name: 'EveryUp' }));
    await expectRingVisible(page, page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link').first());
  });

  test.describe('390px', () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); });

    test('the overview scope links and the palette results are tall enough to tap', async ({ page }) => {
      await page.goto('./');
      const scope = page.getByRole('navigation', { name: '모니터링 범위' }).getByRole('link');
      await expect(scope).toHaveCount(4);
      for (const box of await scope.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
      // 모바일의 새로고침은 테두리 버튼이다(검은 채움이 아니다).
      await expect(page.getByRole('button', { name: '새로고침' })).not.toHaveClass(/bg-primary\b/);

      await page.evaluate(() => window.dispatchEvent(new Event('everyup:command-palette')));
      const options = page.getByRole('dialog', { name: '검색' }).getByRole('option');
      await expect(options.first()).toBeVisible();
      for (const box of await options.evaluateAll((items) => items.slice(0, 5).map((item) => item.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    });

    test('focus rings of the bottom navigation items are not clipped', async ({ page }) => {
      await page.goto('./servers');
      const items = page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('link');
      await expectRingVisible(page, items.first());
      await expectRingVisible(page, items.last());
    });

    test('the server list keeps all logs in its header and its add button says 추가, without overflowing at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto('./servers');
      // 전체 로그는 툴바가 아니라 머리말의 갱신 시각 옆이다. 모바일에서 누르는 높이는 44px 이상이다.
      const allLogs = page.getByRole('main').getByRole('link', { name: '전체 로그', exact: true });
      await expect(allLogs).toHaveAttribute('href', /\/logs$/);
      await expect(page.getByRole('main').getByRole('textbox', { name: '서버 또는 대상 검색' })).toBeVisible();
      expect((await allLogs.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // 주 조작은 이름이 보이는 `추가`다(대상은 제목이 말한다).
      const add = page.getByRole('link', { name: '추가', exact: true });
      await expect(add).toHaveAttribute('href', /\/servers\/new$/);
      expect((await add.getByText('추가').boundingBox())!.width).toBeGreaterThan(20);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      // 제목이 버튼에 밀려 글자마다 줄바꿈되지 않는다(한 줄 높이).
      const title = await page.getByRole('heading', { level: 1, name: /^서버/ }).boundingBox();
      expect(title!.height).toBeLessThan(40);
    });
  });
});

test.describe('times', () => {
  // 브라우저 로캘이 영어여도 시각은 ko-KR 24시간제다.
  test.use({ locale: 'en-US', timezoneId: 'Asia/Seoul', viewport: { width: 1440, height: 1000 } });

  test('stamps and dates ignore the browser locale', async ({ page }) => {
    await page.goto(`./servers/${EDGE}`);
    await expect(page.getByRole('group', { name: '데이터 갱신' }).locator('> p')).toHaveText(/^\d{2}:\d{2}:\d{2} 갱신$/);
    await page.goto('./');
    await expect(page.getByRole('region', { name: '최근 장애 이력' }).getByRole('listitem').first()).toBeVisible();
    const text = await page.getByRole('main').innerText();
    expect(text).not.toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
    expect(text).not.toMatch(/\b(AM|PM)\b|오전|오후/);
  });
});

test.describe('fixtures', () => {
  test.use({ baseURL: API_URL, viewport: { width: 1440, height: 1000 } });

  /** 사용률 경고 서버 넷과 수집이 끊긴 서버 하나(가장 오래된 관찰). 수와 실패는 테스트가 바꾼다. */
  async function mockWarnings(page: Page) {
    const at = new Date().toISOString();
    const stale = new Date(Date.now() - 3_600_000).toISOString();
    const servers: Server[] = ['s1', 's2', 's3', 's4', 's5'].map((id) => ({ id, name: `host-${id}`, createdAt: at, updatedAt: at }));
    const all: InfrastructureResource[] = servers.map((server) => ({
      id: `r-${server.id}`, name: server.name, serverId: server.id, adapter: 'otel-collector', isActive: true, apiKeyMasked: 'evup_****',
      lastSeenAt: server.id === 's5' ? stale : at, memoryUsage: 80, cpuUsage: 10, diskUsage: 10, createdAt: at, updatedAt: at,
    } as InfrastructureResource));
    const state = { count: all.length, failing: false };
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      if (state.failing && path === '/services') { await route.fulfill({ status: 500, json: { success: false, error: { code: 'DATABASE_ERROR', message: 'Fixture request failed' } } }); return; }
      const infrastructure = [...all.slice(0, state.count - 1), all[4]].slice(-state.count);
      const data = path === '/servers' ? servers : path === '/infrastructure-resources' ? infrastructure : [];
      await route.fulfill({ json: { success: true, data } });
    });
    return state;
  }

  test('with no outage the overview says so before the warnings, which expand in place by priority', async ({ page }) => {
    const state = await mockWarnings(page);
    await page.goto('./');
    await expect(attention(page).getByText('장애 0', { exact: true })).toBeVisible();
    await expect(attention(page).getByText('확인 필요 5', { exact: true })).toBeVisible();
    await expect(attention(page).getByText('진행 중인 장애 없음', { exact: true })).toBeVisible();
    await expect(outages(page)).toHaveCount(0);
    // 수집이 끊긴 대상은 관찰 시각이 가장 오래되었어도 사용률 경고보다 먼저 보인다.
    const preview = await expectWarnRows(page, 3);
    await expect(preview.first()).toContainText('host-s5');
    await warnings(page).getByRole('button', { name: '확인 필요 5건 모두 보기' }).click();
    await expectWarnRows(page, 5);

    // 세 건 이하로 줄면 펼친 상태가 풀리고, 다시 늘면 세 건만 보인다.
    state.count = 2;
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expectWarnRows(page, 2);
    await expect(warnings(page).getByRole('button')).toHaveCount(0);
    state.count = 5;
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expectWarnRows(page, 3);
    await expect(warnings(page).getByRole('button', { name: '확인 필요 5건 모두 보기' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('while some targets cannot be loaded the overview does not state counts', async ({ page }) => {
    const state = await mockWarnings(page);
    state.failing = true;
    await page.goto('./');
    await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
    await expect(warnings(page).getByRole('listitem').first()).toBeVisible();
    await expect(attention(page).getByText(/^장애 \d+$/)).toHaveCount(0);
    await expect(attention(page).getByText(/^확인 필요 \d+$/)).toHaveCount(0);
  });

  test('a failed uptime refresh has one notice and one retry', async ({ page }) => {
    const state = await uptimeFixture(page);
    await page.goto('./servers/server-1/uptime');
    await expect(page.getByRole('link', { name: 'Public API', exact: true })).toBeVisible();
    state.failures.set('GET /services', 500);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    const notice = page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' });
    await expect(notice).toContainText('이전에 불러온');
    await expect(notice).toContainText('최신 상태는 확인할 수 없습니다');
    await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Public API', exact: true })).toBeVisible();
  });
});
