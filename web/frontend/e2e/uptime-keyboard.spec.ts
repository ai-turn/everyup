import { expect, test, type Locator, type Page } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/', reducedMotion: 'reduce' });

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

test('[16] add/edit/delete dialogs trap focus and return it to their keyboard trigger', async ({ page }) => {
  await uptimeFixture(page); await page.goto('./uptime');
  const add = page.getByRole('button', { name: '추가', exact: true });
  await tabTo(page, add); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  await expect(dialog).toBeVisible();
  for (const key of ['Tab', 'Shift+Tab', ...Array(12).fill('Tab'), ...Array(12).fill('Shift+Tab')]) {
    await page.keyboard.press(key);
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  const type = dialog.getByRole('combobox', { name: /체크 방식/ });
  await tabTo(page, type); await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('textbox', { name: '호스트', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(add).toBeFocused();
  const target = page.getByRole('link', { name: 'Public API', exact: true });
  await tabTo(page, target); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
  const edit = page.getByRole('button', { name: '수정', exact: true });
  await tabTo(page, edit); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '업타임 수정' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(edit).toBeFocused();
  const remove = page.getByRole('button', { name: '삭제', exact: true });
  await tabTo(page, remove); await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog', { name: '업타임을 삭제할까요?' });
  await expect(confirm.getByRole('button', { name: '취소', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm.getByRole('button', { name: '삭제', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(confirm).toHaveCount(0); await expect(remove).toBeFocused();
});

test('[16] mobile keyboard focus remains above bottom navigation and charts are single stops', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await uptimeFixture(page); await page.goto('./uptime/http-monitor');
  await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
  const history = page.getByRole('group', { name: /최근 90일/ });
  const response = page.getByRole('group', { name: /체크별/ });
  // Each chart is one stop: the response chart, then the 90-day strip, then the outage history's three filters.
  await tabTo(page, response); await page.keyboard.press('Home'); await page.keyboard.press('End');
  await page.keyboard.press('Tab'); await expect(history).toBeFocused();
  await page.keyboard.press('End');
  for (const name of ['전체', '장애', '실패']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('group', { name: '장애 이력 구분' }).getByRole('button', { name, exact: true })).toBeFocused();
  }
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    await expect.poll(async () => page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      if (!element.closest('main')) return true;
      const bottom = document.querySelector('nav[aria-label="모바일 내비게이션"]')?.getBoundingClientRect().top ?? innerHeight - 64;
      const rect = element.getBoundingClientRect();
      return rect.bottom <= bottom + 1 && rect.top >= 0;
    })).toBe(true);
  }
});
