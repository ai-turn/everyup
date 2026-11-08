import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules/playwright/index.mjs')));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light' });
  for (const [id, route] of [['list', 'logs?view=card'], ['detail', 'logs/observed_mock_checkout?range=24h']]) {
    await page.goto(`http://127.0.0.1:5197/everyup/demo/${route}`);
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(dir, `${id}-initial.png`), fullPage: true });
    await fs.writeFile(path.join(dir, `${id}-initial.txt`), await page.locator('body').innerText());
    console.log(JSON.stringify({id, snapshot: await page.locator('main').ariaSnapshot()}));
  }
  console.log(JSON.stringify({browser: browser.version(), fixtures: await page.evaluate(async () => {
    const {mockRouter} = await import('/everyup/demo/src/services/mockRouter.ts');
    return {services: await mockRouter('/observed-services'), logs: await mockRouter('/observed-services/observed_mock_checkout/logs?limit=25')};
  })}));
} finally { await browser.close(); }
