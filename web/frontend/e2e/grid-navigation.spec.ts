import { expect, test, type Locator } from '@playwright/test';

const menus = [
  ['projects', 'Projects 그리드'],
  ['environments', 'Docker 환경 그리드'],
  ['uptime', '업타임 그리드'],
  ['logs', '로그 서비스 그리드'],
  ['infrastructure', '인프라 대상 그리드'],
  ['api', 'API 대상 그리드'],
  ['metrics', '메트릭 서비스 그리드'],
  ['agents/agent_demo_01', 'Docker 서비스 그리드'],
  ['projects/project_mock_production', 'Project 구성 그리드'],
] as const;

async function blankCorner(row: Locator) {
  const box = await row.boundingBox();
  if (!box) throw new Error('Row is not visible');
  return { x: box.width - 8, y: box.height - 8 };
}

for (const width of [1440, 375]) for (const [route, label] of menus) {
  test(`${width}px ${route} opens its detail from row whitespace and keeps native link navigation`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`./${route}?origin=row-test`);
    const listUrl = page.url();
    const table = page.getByRole('table', { name: label, exact: true });
    const row = table.getByRole('row').filter({ has: page.getByRole('link') }).first();
    const link = row.getByRole('link').first();
    const destination = await link.getAttribute('href');
    await expect(row).toHaveCSS('cursor', 'pointer');
    await row.click({ position: await blankCorner(row) });
    await expect(page).toHaveURL(new URL(destination!, listUrl).href);
    await page.goBack();
    await expect(page).toHaveURL(listUrl);
    await expect(table).toBeVisible();
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new URL(destination!, listUrl).href);
    await page.goBack();
    await expect(page).toHaveURL(listUrl);
  });
}

for (const mode of ['modifier', 'middle'] as const) {
  test(`${mode} click on row whitespace opens the actual detail in a new tab`, async ({ page }) => {
    await page.goto('./projects');
    const listUrl = page.url();
    const table = page.getByRole('table', { name: 'Projects 그리드', exact: true });
    const row = table.getByRole('row').filter({ has: page.getByRole('link') }).first();
    const link = row.getByRole('link').first();
    const destination = new URL((await link.getAttribute('href'))!, listUrl).href;
    const position = await blankCorner(row);
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5000 }),
      row.click({ position, ...(mode === 'middle' ? { button: 'middle' as const } : { modifiers: ['ControlOrMeta' as const] }) }),
    ]);
    await expect(popup).toHaveURL(destination);
    await expect(page).toHaveURL(listUrl);
    await popup.close();
  });
}

test('dragging row text selects it without opening the detail', async ({ page }) => {
  await page.goto('./logs');
  const listUrl = page.url();
  const row = page.getByRole('table', { name: '로그 서비스 그리드' }).getByRole('row').filter({ has: page.getByRole('link', { name: 'payment-worker', exact: true }) });
  const subtitle = row.locator('td').first().locator('p').first();
  const box = await subtitle.boundingBox();
  if (!box) throw new Error('Subtitle is not visible');
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain('prod-server');
  await expect(page).toHaveURL(listUrl);
});

test('pending installation rows keep their menu actions without a detail destination', async ({ page }) => {
  await page.goto('./environments?q=staging');
  const listUrl = page.url();
  const row = page.getByRole('table', { name: 'Docker 환경 그리드' }).getByRole('row').filter({ hasText: 'staging-api' });
  await expect(row).not.toHaveCSS('cursor', 'pointer');
  await row.click({ position: await blankCorner(row) });
  await expect(page).toHaveURL(listUrl);
  await row.getByText('설치·작업', { exact: true }).click();
  await row.getByRole('button', { name: 'API Key', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'staging-api · API Key', exact: true })).toBeVisible();
  await expect(page).toHaveURL(listUrl);
});
