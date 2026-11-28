import { expect, test, type Locator, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { mockRouter } from '../src/services/mockRouter';
import type { AgentServiceFlat, ConnectedAgent, InfrastructureResource, Server } from '../src/services/api';
import { uptimeFixture } from './fixtures/uptime';

// 전환 후 화면의 디자인 수정(Task 14b). 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표(attention 시나리오)를 따른다.
const EDGE = 'server_mock_edge_host_01';
const attention = (page: Page) => page.getByRole('region', { name: '주의 필요' });
const summary = (page: Page) => page.getByRole('region', { name: '요약' });
const panel = (page: Page) => page.getByRole('tabpanel');


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

  test('the overview lists the servers that need attention and counts outages like the sidebar badge', async ({ page }) => {
    const payment = mockRouter<AgentServiceFlat[]>('/agents/services/all').find((service) => service.name === 'payment-worker')!;
    await page.goto('./');
    // 요약 띠의 활성 장애는 사이드바의 배지와 같은 수다(링크 이름은 "개요 장애 2건").
    await expect(summary(page)).toContainText(/활성 장애2건/);
    await expect(summary(page)).toContainText(/장애 2확인 필요 3/);
    await expect(page.locator('aside').getByRole('link', { name: /^개요/ })).toHaveAccessibleName(/^개요 장애 2\s*건$/);

    // 주의 필요는 서버 단위다(G안): 장애 → 확인 필요 → 연결 전 대기 순이고, 행은 서버 화면으로 간다.
    const rows = attention(page).getByRole('listitem');
    await expect(rows.first()).toContainText('edge-host-01');
    await expect(rows.first()).toContainText('Checkout API');
    await expect(rows.nth(1)).toContainText(payment.agentName);
    await expect(rows.nth(1)).toContainText('payment-worker');
    await expect(rows.first().getByRole('link')).toHaveAttribute('href', new RegExp(`/servers/${EDGE}$`));
    const order = { 장애: 0, '확인 필요': 1, 대기: 2 } as const;
    const states = await rows.evaluateAll((items) => items.map((item) => item.querySelector('a > span:nth-child(2)')?.textContent ?? ''));
    const ranks = states.map((state) => order[state as keyof typeof order]);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    // 원인은 그 서버의 이상을 모두 잇는다. 사용률은 기준과 함께 적는다.
    await expect(rows.filter({ hasText: 'db-primary-01' })).toContainText('메모리 84.6% · 기준 70%');

    // 전체 로그는 요약 띠의 에러 로그 제목에서 간다.
    await expect(summary(page).getByRole('link', { name: '에러 로그', exact: true })).toHaveAttribute('href', /\/logs$/);

    // 최근 장애의 행에도 부모(서버)의 이름이 있다.
    const history = page.getByRole('region', { name: '최근 장애' });
    await expect(history.getByRole('link', { name: /edge-host-01 \/ Checkout API/ })).toBeVisible();
    await expect(history.getByRole('link', { name: new RegExp(`${payment.agentName} / payment-worker`) })).toBeVisible();
  });

  test('the server logs tab and the more page lead to all logs, and an app opened there returns to it', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs`);
    await panel(page).getByRole('link', { name: '모든 서버의 로그', exact: true }).click();
    await expect(page).toHaveURL(/\/logs$/);
    // 직접 연결한 앱만 나온다. Docker 서버가 있으면 끝에 그 로그의 자리(Docker 서버만 걸러 본 서버 목록)를 알린다.
    await expect(page.getByText('컨테이너의 로그는 그 서버의 로그 탭에 있습니다.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Docker Collector가 있는 서버', exact: true })).toHaveAttribute('href', /\/servers\?connection=docker$/);

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
    // 다섯 기능 모두 여기서 시작할 수 있다. 설치가 필요 없는 업타임이 주 버튼이다.
    await expect(panel(page).getByRole('button')).toHaveText(['업타임 모니터 추가', '인프라 연결', '로그 연결', 'API 요청 연결', '메트릭 연결', 'Docker Collector 설치']);
    await panel(page).getByRole('button', { name: '업타임 모니터 추가', exact: true }).click();
    await expect(page).toHaveURL(/\/servers\/server_mock_staging_empty\/uptime$/);
    const dialog = page.getByRole('dialog', { name: '업타임 모니터 추가' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(panel(page).getByText('이 서버의 업타임 모니터를 추가하세요', { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  test('the palette finds monitors and apps', async ({ page }) => {
    await page.goto('./');
    const open = page.locator('aside').getByRole('button', { name: /^검색/ });
    await open.click();
    const palette = page.getByRole('dialog', { name: '검색' });
    await palette.getByRole('textbox', { name: '검색' }).fill('Checkout');
    const monitor = palette.getByRole('option', { name: /^Checkout API/ });
    await expect(monitor).toContainText('edge-host-01의 모니터');
    await monitor.click();
    await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/monitors/uptime_mock_checkout$`));
    // 그룹은 없다(ADR 0013). 옛 그룹 이름은 찾아지지 않는다.
    await open.click();
    await palette.getByRole('textbox', { name: '검색' }).fill('Backoffice');
    await expect(palette.getByRole('option')).toHaveCount(0);
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

  test('the alert target picker groups containers and directly connected targets, both under their server', async ({ page }) => {
    await page.goto('./alerts?tab=rules');
    await page.getByRole('button', { name: '규칙 추가' }).click();
    await page.getByRole('combobox', { name: '대상' }).click();
    const listbox = page.getByRole('listbox');
    // 컨테이너 앞의 이름은 그 Docker 서버의 이름이다(ADR 0012).
    await expect(listbox.getByRole('group', { name: 'Docker Collector' }).getByRole('option', { name: 'prod-server / payment-worker' })).toBeVisible();
    const servers = listbox.getByRole('group', { name: '직접 연결' });
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

    test('the overview links and the palette results are tall enough to tap', async ({ page }) => {
      await page.goto('./');
      const links = page.locator('main').getByRole('link', { name: /^(서버 전체 보기|에러 로그)$/ });
      await expect(links).toHaveCount(2);
      for (const box of await links.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
      // 모바일의 새로고침은 테두리 버튼이다(검은 채움이 아니다).
      await expect(page.getByRole('button', { name: '새로고침' })).not.toHaveClass(/bg-accent\b/);

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
    // 보이는 글자는 지난 시간(`마지막 확인 8초 전`)이고, 화면 낭독기에는 갱신 시각을 알린다.
    await expect(page.getByRole('group', { name: '데이터 갱신' }).locator('[aria-live]')).toHaveText(/^\d{2}:\d{2}:\d{2} 갱신$/);
    await expect(page.getByRole('group', { name: '데이터 갱신' }).locator('> p')).toContainText(/^마지막 확인 \d+초 전/);
    await page.goto('./');
    await expect(page.getByRole('region', { name: '최근 장애' }).getByRole('listitem').first()).toBeVisible();
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

  test('with no outage the overview says so, and the attention list follows each refresh', async ({ page }) => {
    const state = await mockWarnings(page);
    await page.goto('./');
    await expect(summary(page)).toContainText(/활성 장애0건/);
    await expect(summary(page)).toContainText('진행 중 장애 없음');
    const rows = attention(page).getByRole('listitem');
    await expect(rows).toHaveCount(5);
    for (const text of await rows.allInnerTexts()) expect(text).toContain('확인 필요');
    // 인프라를 거둔 서버는 연결한 대상이 없는 대기(`연결 전`)로 남는다.
    state.count = 2;
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(rows.filter({ hasText: '확인 필요' })).toHaveCount(2);
  });

  test('while some targets cannot be loaded the overview does not state counts', async ({ page }) => {
    const state = await mockWarnings(page);
    state.failing = true;
    await page.goto('./');
    await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
    await expect(attention(page).getByRole('listitem').first()).toBeVisible();
    // 제목 옆 개수와 정상 서버 수를 단정하지 않는다.
    await expect(attention(page).locator('h2 + span')).toHaveCount(0);
    await expect(summary(page)).toContainText('정상 서버-');
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
