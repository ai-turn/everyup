import { expect, test, type Page } from '@playwright/test';

async function expectUnobscuredFocus(page: Page) {
  await expect.poll(() => page.locator(':focus').evaluate((element) => {
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
    const project = page.getByRole('link', { name: /그룹으로 대상 정리하기/ });
    const lastIncident = page.getByRole('region', { name: '최근 장애 이력' }).getByRole('link').last();
    await expect(lastIncident).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(refresh).toBeFocused();

    let visitedProject = false;
    for (let step = 0; step < 20; step++) {
      await expectUnobscuredFocus(page);
      visitedProject ||= await project.evaluate((element) => element === document.activeElement);
      if (await lastIncident.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(lastIncident).toBeFocused();
    expect(visitedProject).toBe(true);

    visitedProject = false;
    for (let step = 0; step < 20; step++) {
      await page.keyboard.press('Shift+Tab');
      await expectUnobscuredFocus(page);
      visitedProject ||= await project.evaluate((element) => element === document.activeElement);
      if (await refresh.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(refresh).toBeFocused();
    expect(visitedProject).toBe(true);
  });
}
