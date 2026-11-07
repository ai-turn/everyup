import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(path.join(process.env.TEMP,
  'everyup-design-check-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')));
const browser = await puppeteer.launch({ headless: true,
  executablePath: 'C:/Users/tmddn/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' });
const page = await browser.newPage();
const observations = {};
const app = 'http://127.0.0.1:5187/everyup/demo/';
async function visit(url, width = 1440, height = 900) {
  await page.setViewport({ width, height, isMobile: width < 600, hasTouch: width < 600 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(resolve => setTimeout(resolve, 400));
}
try {
  await visit(`${app}alerts/channels/new`);
  observations.formFields = await page.$$eval('input:not([type=radio]):not([type=hidden])', fields => fields.map(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { id: el.id, border: s.borderColor, fill: s.backgroundColor, parentFill: getComputedStyle(el.parentElement).backgroundColor,
      width: r.width, height: r.height };
  }));
  const guide = await page.evaluateHandle(() => [...document.querySelectorAll('span')]
    .find(el => el.textContent.trim() === 'API Key는 어떻게 발급받나요?'));
  const inspectGuide = () => guide.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const clips = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(p).overflowY)) {
        const box = p.getBoundingClientRect();
        clips.push({ tag: p.tagName, class: p.className, top: box.top, bottom: box.bottom, scrollTop: p.scrollTop, scrollHeight: p.scrollHeight, clientHeight: p.clientHeight });
      }
    }
    return { rect: { top: r.top, bottom: r.bottom }, hit: hit?.outerHTML.slice(0, 160),
      reachable: hit === el || el.contains(hit), clips };
  });
  observations.guideBeforeScroll = await inspectGuide();
  await guide.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  observations.guideAfterScroll = await inspectGuide();
  await page.screenshot({ path: path.join(root, 'screenshots/channel-guide-after-scroll.png') });

  for (const width of [1440, 390]) {
    await visit(`${app}services/agent_demo_01/shop%3Apayment-worker?tab=metrics`, width, width === 390 ? 844 : 900);
    const small = await page.$$eval('main button', buttons => buttons.map(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return { label: el.getAttribute('aria-label') || el.textContent.trim(), width: r.width, height: r.height,
        class: el.className, before: getComputedStyle(el, '::before').content,
        after: getComputedStyle(el, '::after').content, display: s.display };
    }).filter(el => el.width > 0 && el.height > 0 && el.height < 32));
    observations[`smallMetricControls${width}`] = small;
  }
  await visit(`${app}services/agent_demo_01/shop%3Apayment-worker?tab=logs`);
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some(el => el.getAttribute('role') !== 'tab' && el.textContent.trim().endsWith('트레이스')));
  const trace = (await page.evaluateHandle(() => [...document.querySelectorAll('button')]
    .find(el => el.getAttribute('role') !== 'tab' && el.textContent.trim().endsWith('트레이스')))).asElement();
  await trace.focus();
  await page.keyboard.press('Enter');
  await new Promise(resolve => setTimeout(resolve, 200));
  observations.keyboardTrace = await trace.evaluate(el => ({
    dialogOpened: Boolean(document.querySelector('[role=dialog][aria-label="트레이스 상세"]')),
    rowExpanded: el.closest('[aria-expanded]')?.getAttribute('aria-expanded'),
    focused: el === document.activeElement,
  }));
  await page.screenshot({ path: path.join(root, 'screenshots/keyboard-trace-enter.png') });

  await visit('http://127.0.0.1:5188/everyup/');
  observations.homeShadowElements = await page.evaluate(() => [...document.querySelectorAll('*')].map(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { tag: el.tagName, class: el.className, shadow: s.boxShadow, width: r.width, height: r.height,
      opacity: s.opacity, visibility: s.visibility };
  }).filter(el => el.shadow !== 'none'));
  const detector = await fs.readFile('C:/dev/mt-app/.claude/skills/impeccable/scripts/detector/detect-antipatterns-browser.js', 'utf8');
  await page.evaluate(() => { window.__IMPECCABLE_CONFIG__ = { autoScan: false }; });
  await page.evaluate(detector);
  observations.homeDetectorGroups = await page.evaluate(() => window.impeccableDetect({ decorate: false, serialize: true })
    .filter(group => group.findings.some(f => ['dark-glow', 'line-length'].includes(f.type))));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluate(() => { window.__IMPECCABLE_CONFIG__ = { autoScan: false }; });
  await page.evaluate(detector);
  observations.homeMobileDetectorGroups = await page.evaluate(() => window.impeccableDetect({ decorate: false, serialize: true })
    .filter(group => group.findings.some(f => f.type === 'clipped-overflow-container')));
  observations.recordedAt = new Date().toISOString();
  await fs.writeFile(path.join(root, 'verified-observations.json'), JSON.stringify(observations, null, 2) + '\n');
  console.log(JSON.stringify({ keyboardTrace: observations.keyboardTrace,
    guideReachableAfterScroll: observations.guideAfterScroll.reachable,
    smallMetricControls1440: observations.smallMetricControls1440.length,
    smallMetricControls390: observations.smallMetricControls390.length }));
} finally { await browser.close(); }
