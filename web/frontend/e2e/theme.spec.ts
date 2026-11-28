import { expect, test } from '@playwright/test';

// 테마 4종(tokens.css)과 선택 저장. 기본값은 OS의 라이트/다크를 따르고, 고른 테마는 localStorage에 남는다.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`without a saved choice the theme follows the OS ${colorScheme} preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
  });
}

test('the sidebar theme picker switches all four themes and the choice survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  const picker = page.getByRole('group', { name: '테마', exact: true });
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const seen = new Set<string>();
  for (const [label, theme] of [['다크', 'dark'], ['Latte', 'latte'], ['Mocha', 'mocha'], ['라이트', 'light']] as const) {
    await picker.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(picker.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    seen.add(await bg());
  }
  // 테마마다 바탕색이 다르다 — 토큰이 실제로 바뀌었다는 뜻이다.
  expect(seen.size).toBe(4);
  await picker.getByRole('button', { name: 'Mocha', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'mocha');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('mocha');
});

test('the settings page offers the same four themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./settings');
  const group = page.locator('main').getByRole('group', { name: '테마', exact: true });
  await expect(group.getByRole('button')).toHaveText(['다크', '라이트', 'Latte', 'Mocha']);
  await group.getByRole('button', { name: 'Latte', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'latte');
});
