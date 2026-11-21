import { expect, test, type Page } from '@playwright/test';

// 간격 관계 검사(DESIGN.md §3.7 관계 토큰, §10.I P2). 공용 프리미티브가 단 표지만 잰다:
//   data-gap-after="<토큰>"  이 요소의 아래 → 다음 형제의 위
//   data-gap="<토큰>"        앞 형제의 아래 → 이 요소의 위
// 글자 상자가 아니라 요소 박스 사이를 잰다. 글꼴 메트릭·대체 글꼴에 따라 흔들리지 않고 CSS 값 그대로 나온다.
// 다음 형제가 음수 여백으로 펼쳐진 목록(list-bleed)이면 그만큼 되돌린다(행의 hover 패딩 안쪽이 보이는 위치다).
// 화면마다 (1) 표지의 간격이 토큰 ±1px이고 (2) 근접성 불변식 intra < label < heading < item ≤ group < section을 지키는지 본다.
// 위치(절대 y)는 보지 않는다. 위의 블록이 바뀌어도 이 검사는 깨지지 않는다.

// 재시도로 흔들림을 숨기지 않는다(CI는 기본 2회 재시도).
test.describe.configure({ retries: 0 });

const TOKENS = { intra: 4, label: 8, heading: 16, item: 20, group: 24, section: 32 } as const;
type Token = keyof typeof TOKENS;
const ORDER: Token[] = ['intra', 'label', 'heading', 'item', 'group', 'section'];

const E = 'server_mock_edge_host_01';
const open = (name: string) => async (page: Page) => { await page.getByRole('button', { name, exact: true }).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); };
// [이름, 주소, 측정 전 조작]. #133~#141 점검에서 간격 문제가 나왔던 화면들이다.
const SCREENS: [string, string, ((page: Page) => Promise<void>)?][] = [
  ['overview', './'],
  ['server overview', `./servers/${E}`],
  ['server uptime detail', `./servers/${E}/uptime/uptime_mock_checkout`],
  // 앱은 자기 페이지가 있다(대상 상세, 2026-11-21). 서버의 API 요청·메트릭 탭은 표지 없는 앱 목록(표)이라 앱 페이지를 잰다.
  ['app logs', `./servers/${E}/apps/observed_mock_checkout?tab=logs`],
  ['app requests', `./servers/${E}/apps/observed_mock_orders?tab=requests`],
  ['app metrics', `./servers/${E}/apps/observed_mock_orders?tab=metrics`],
  ['server infrastructure', `./servers/${E}/infrastructure`],
  ['all logs', './logs'],
  ['alert history', './alerts?tab=history'],
  ['alert rule drawer', './alerts?tab=rules', open('규칙 추가')],
  ['new channel', './alerts/channels/new'],
  ['settings', './settings'],
  ['add monitor dialog', `./servers/${E}/uptime`, open('모니터 추가')],
  ['docker connect dialog', './environments', open('Docker 연결')],
];

// 지금 어긋나 있는 자리(`토큰: 위 요소` 앞부분, 값은 OS 글꼴에 따라 다를 수 있어 적지 않는다)와, 아직 표지 붙은 프리미티브를 쓰지 않는 화면(§10.I). 고치는 단계에서 여기서 지운다.
// 목록과 실제가 다르면 실패한다: 고쳤는데 남아 있어도, 새로 어긋나도.
// 2026-11-21 P6에서 비었다(인프라 차트 캡션이 ChartCard의 설명 줄이 되었다). 새로 어긋나는 자리를 여기에 적어 넘기지 않는다.
const KNOWN_OFF: Record<string, string[]> = {};
const KNOWN_EMPTY: Record<string, number[]> = {
  // 의도한 예외(DESIGN.md §3.7): 기능 묶음이 넓은 화면에서 제목을 왼쪽 열에, 내용을 오른쪽 열에 두는 옆 라벨 배치라
  // 제목 → 내용이 세로 간격이 아니다. Section(제목 위, 내용 아래)으로 바꾸지 않는다.
  'server overview': [1440, 390],
};

type Gap = { token: Token; gap: number; at: string };

function measure(): Gap[] {
  const visible = (el: Element | null): el is HTMLElement => {
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const sibling = (el: Element, dir: 'next' | 'previous') => {
    let s = dir === 'next' ? el.nextElementSibling : el.previousElementSibling;
    while (s && !visible(s)) s = dir === 'next' ? s.nextElementSibling : s.previousElementSibling;
    return s;
  };
  // 음수 여백(list-bleed)은 펼친 만큼 되돌려 보이는 위치로 본다. 첫 자식이 위 여백만 음수로 당겨 올라왔으면(-mt-2 같은 끌어당김,
  // 좌우는 그대로) 그 자식이 보이는 위치다 — 부모 상자는 제자리인데 글이 위 요소에 붙어 보인다.
  const top = (el: Element) => {
    let at = el.getBoundingClientRect().top - Math.min(0, parseFloat(getComputedStyle(el).marginTop));
    for (let child = el.firstElementChild, depth = 0; child && depth < 4; child = child.firstElementChild, depth++) {
      const style = getComputedStyle(child);
      if (parseFloat(style.marginTop) < 0 && parseFloat(style.marginLeft) >= 0) at = Math.min(at, child.getBoundingClientRect().top);
    }
    return at;
  };
  const bottom = (el: Element) => el.getBoundingClientRect().bottom + Math.min(0, parseFloat(getComputedStyle(el).marginBottom));
  const name = (el: Element) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`;
  const gaps: Gap[] = [];
  for (const el of document.querySelectorAll('[data-gap-after]')) {
    const next = visible(el) && sibling(el, 'next');
    if (next) gaps.push({ token: el.getAttribute('data-gap-after') as Token, gap: Math.round(top(next) - bottom(el)), at: `${name(el)} → ${name(next)}` });
  }
  for (const el of document.querySelectorAll('[data-gap]')) {
    const previous = visible(el) && sibling(el, 'previous');
    if (previous) gaps.push({ token: el.getAttribute('data-gap') as Token, gap: Math.round(top(el) - bottom(previous)), at: `${name(previous)} → ${name(el)}` });
  }
  return gaps;
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport, reducedMotion: 'reduce' });

    for (const [name, path, action] of SCREENS) {
      test(`${name} keeps its spacing relations`, async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-11-21T06:00:00Z'));
        await page.goto(path);
        await expect(page.locator('#main-content h1').first()).toBeAttached();
        await expect(page.getByText('불러오는 중', { exact: true })).toHaveCount(0);
        if (action) await action(page);
        // 부하가 크면 스타일시트가 늦게 붙어 스타일 없는 화면을 잴 수 있다(4 workers 전체 실행에서 한 번 있었다).
        await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every((link) => (link as HTMLLinkElement).sheet)
          && getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
        await page.evaluate(() => document.fonts.ready);
        if (KNOWN_EMPTY[name]?.includes(viewport.width)) {
          await page.waitForTimeout(300);
          expect(await page.locator('[data-gap], [data-gap-after]').count(), '표지가 생겼으면 KNOWN_EMPTY에서 지운다').toBe(0);
          return;
        }
        // 표지가 붙은 프리미티브가 그려질 때까지 기다린다. 없으면 여기서 실패한다(검사가 아무것도 재지 않고 통과하지 않게).
        await expect(page.locator('[data-gap], [data-gap-after]').first()).toBeAttached();

        const measured = await page.evaluate(measure);
        const known = KNOWN_OFF[name] ?? [];
        const isOff = ({ token, gap }: Gap) => Math.abs(gap - TOKENS[token]) > 1;
        const off = measured.filter(isOff);
        const isKnown = (g: Gap) => known.some((k) => `${g.token}: ${g.at}`.startsWith(k));
        expect(off.filter((g) => !isKnown(g)).map(({ token, gap, at }) => `${token} ${TOKENS[token]} ≠ ${gap}: ${at}`), '새로 어긋난 간격').toEqual([]);
        expect(known.filter((k) => !off.some((g) => `${g.token}: ${g.at}`.startsWith(k))), '고쳐졌으면 KNOWN_OFF에서 지운다').toEqual([]);
        const gaps = measured.filter((g) => !isOff(g));

        // 안쪽 < 바깥쪽: 낮은 단계에서 잰 가장 큰 값이 높은 단계에서 잰 가장 작은 값보다 작다(item ≤ group만 같아도 된다).
        const seen = ORDER.filter((token) => gaps.some((g) => g.token === token));
        for (let i = 1; i < seen.length; i++) {
          const inner = Math.max(...gaps.filter((g) => g.token === seen[i - 1]).map((g) => g.gap));
          const outer = Math.min(...gaps.filter((g) => g.token === seen[i]).map((g) => g.gap));
          if (seen[i - 1] === 'item' && seen[i] === 'group') expect(inner, `${seen[i - 1]} ≤ ${seen[i]}`).toBeLessThanOrEqual(outer);
          else expect(inner, `${seen[i - 1]} < ${seen[i]}`).toBeLessThan(outer);
        }
      });
    }
  });
}
