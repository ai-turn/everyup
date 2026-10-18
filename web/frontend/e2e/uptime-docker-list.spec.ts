import { expect, test } from '@playwright/test';
import { dockerService, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('[01 audit] Docker list and detail agree for paused, unseen and delayed snapshots', async ({ page }) => {
  const state = await uptimeFixture(page); state.monitors = [];
  state.services = [
    dockerService({ key: 'fresh-up', name: 'Fresh up' }),
    dockerService({ key: 'fresh-down', name: 'Fresh down', healthy: false }),
    dockerService({ key: 'paused', name: 'Paused Docker', silenced: true }),
    dockerService({ key: 'waiting', name: 'Waiting Docker', seen: false, observedAt: '' }),
    dockerService({ key: 'delayed', name: 'Delayed Docker', observedAt: new Date(Date.now() - 3_600_000).toISOString() }),
  ];
  await page.goto('./uptime');
  for (const [name, label] of [['Fresh up', '정상'], ['Fresh down', '장애'], ['Paused Docker', '일시정지'], ['Waiting Docker', '확인 대기'], ['Delayed Docker', '수집 지연']]) {
    const card = page.getByRole('row').or(page.getByRole('article')).filter({ has: page.getByRole('link', { name, exact: true }) });
    await expect(card.getByText(label, { exact: true })).toBeVisible();
  }
  const summary = page.getByRole('region', { name: '업타임 상태 요약' });
  await expect(summary.locator('dd')).toHaveText(['1', '1', '3']);
  // The summary's visible numbers must partition all five targets: one up, one down, three unknown/paused.
  const text = await summary.innerText();
  expect(text).toContain('일시정지 1개'); expect(text).toContain('확인 대기 1개'); expect(text).toContain('수집 지연 1개');
});
