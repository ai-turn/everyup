import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const skill = 'C:/dev/mt-app/.claude/skills/impeccable/scripts/detector/detect-antipatterns.mjs';
const { detectUrl, loadDesignSystemForCwd } = await import(pathToFileURL(skill));
const puppeteerPath = path.join(process.env.TEMP, 'everyup-design-check-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
const { default: puppeteer } = await import(pathToFileURL(puppeteerPath));
const browser = await puppeteer.launch({
  executablePath: 'C:/Users/tmddn/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  headless: true,
});
const frontend = path.resolve(out, '../../web/frontend');
const designSystem = loadDesignSystemForCwd(frontend);
const targets = process.argv.slice(2);
const resultPath = path.join(out, 'impeccable-render.json');
const results = targets.length ? JSON.parse(await fs.readFile(resultPath, 'utf8')).filter(record => !targets.some(target => record.id.startsWith(`${target}-`))) : [];
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true });
try {
  for (const [surface, url] of [
    ['overview', 'http://127.0.0.1:5187/everyup/demo/'],
    ['metrics', 'http://127.0.0.1:5187/everyup/demo/services/agent_demo_01/shop%3Apayment-worker?tab=metrics'],
    ['channel-form', 'http://127.0.0.1:5187/everyup/demo/alerts/channels/new'],
    ['home', 'http://127.0.0.1:5188/everyup/'],
  ]) {
    if (targets.length && !targets.includes(surface)) continue;
    for (const [device, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      for (const theme of ['light', 'dark']) {
        const id = `${surface}-${device}-${theme}`;
        const context = await browser.createBrowserContext();
        const record = { id, url, viewport: { width, height }, theme, findings: [], error: null };
        try {
          const themedBrowser = { newPage: async () => {
            const page = await context.newPage();
            await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
            const close = page.close.bind(page);
            page.close = async () => {
              if (!page.isClosed()) {
                await page.evaluate(() => document.fonts.ready).catch(() => {});
                await page.screenshot({ path: path.join(out, 'screenshots', `${id}.png`) });
                record.observed = await page.evaluate(() => ({
                  time: new Date().toISOString(), url: location.href, ua: navigator.userAgent,
                  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                  width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
                  headings: [...document.querySelectorAll('h1,h2,h3')].map(el => el.textContent),
                }));
              }
              await close();
            };
            return page;
          }};
          record.findings = await detectUrl(url, {
            browser: themedBrowser, designSystem: surface === 'home' ? undefined : designSystem,
            viewport: { width, height, isMobile: device === 'mobile', hasTouch: device === 'mobile' },
            waitUntil: 'networkidle2', settleMs: 700,
          });
        } catch (error) { record.error = String(error); }
        finally { await context.close(); }
        results.push(record);
        await fs.writeFile(path.join(out, 'impeccable-render.json'), JSON.stringify(results, null, 2) + '\n');
        console.log(JSON.stringify({ id, findings: record.findings.length, error: record.error }));
      }
    }
  }
} finally { await browser.close(); }
if (results.some(record => record.error)) process.exitCode = 1;
