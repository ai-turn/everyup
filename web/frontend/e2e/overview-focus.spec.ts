import { expect, test, type Page } from '@playwright/test';

async function expectUnobscuredFocus(page: Page) {
  await expect.poll(() => page.locator(':focus').evaluate((element) => {
    // AppHeader(본문 밖, 스크롤되지 않음)의 컨트롤은 가려질 일이 없다.
    if (!element.closest('main')) return 0;
    const bounds = element.getBoundingClientRect();
    const scrollport = document.querySelector('main > div')!.getBoundingClientRect();
    const navigation = document.querySelector('nav.fixed.bottom-0')!.getBoundingClientRect();
    const bottom = navigation.height > 0 ? Math.min(scrollport.bottom, navigation.top) : scrollport.bottom;
    // The global focus outline extends 4px beyond the element.
    return Math.max(scrollport.top + 4 - bounds.top, bounds.bottom + 4 - bottom, 0);
  }), { message: 'Focused content and its outline must stay above the bottom navigation' }).toBe(0);
}

for (const { width, height, reducedMotion } of [
  { width: 375, height: 812, reducedMotion: 'no-preference' as const },
  { width: 375, height: 812, reducedMotion: 'reduce' as const },
  { width: 812, height: 375, reducedMotion: 'no-preference' as const },
  { width: 1440, height: 900, reducedMotion: 'no-preference' as const },
]) {
  test(`overview keyboard focus remains visible at ${width}x${height}, ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion });
    await page.goto('./');
    const refresh = page.getByRole('button', { name: '새로고침', exact: true });
    // 범위 줄의 마지막 링크. 본문 안의 링크를 앞뒤로 모두 지나는지 본다.
    const scopeLink = page.getByRole('navigation', { name: '모니터링 범위' }).getByRole('link', { name: '전체 로그', exact: true });
    const lastIncident = page.getByRole('region', { name: '최근 장애 이력' }).getByRole('link').last();
    await expect(lastIncident).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();
    await page.keyboard.press('Enter');
    // 개요의 새로고침은 데스크톱에서 AppHeader(본문 앞)에 있다. 본문 바로가기는 그것을 건너뛰어
    // 본문의 첫 링크로 가고, 아래 Shift+Tab 순회가 헤더의 새로고침까지 거슬러 닿는지 확인한다.
    await page.keyboard.press('Tab');
    // 모바일은 AppHeader가 없어 갱신 상태(RefreshStatus: 갱신 시각 툴팁 → 새로고침 → 자동 갱신)가 본문 첫 요소로 남는다.
    await expect(width >= 1024 ? page.locator('main').getByRole('link', { name: /^서버/ }) : page.getByRole('group', { name: '데이터 갱신' }).getByText(/^[0-9:]+ 갱신$/)).toBeFocused();

    let visitedScope = false;
    for (let step = 0; step < 20; step++) {
      await expectUnobscuredFocus(page);
      visitedScope ||= await scopeLink.evaluate((element) => element === document.activeElement);
      if (await lastIncident.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(lastIncident).toBeFocused();
    expect(visitedScope).toBe(true);

    visitedScope = false;
    for (let step = 0; step < 20; step++) {
      await page.keyboard.press('Shift+Tab');
      await expectUnobscuredFocus(page);
      visitedScope ||= await scopeLink.evaluate((element) => element === document.activeElement);
      if (await refresh.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(refresh).toBeFocused();
    expect(visitedScope).toBe(true);
  });
}
