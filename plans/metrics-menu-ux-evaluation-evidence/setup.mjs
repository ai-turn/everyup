// 메트릭 연결(추가) 흐름: 새 서비스 → 결과(키 마스킹), 기존 서비스 탭.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const tools = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules');
const { chromium } = await import(pathToFileURL(path.join(tools, 'playwright/index.mjs')));
const axePath = path.join(tools, 'axe-core/axe.min.js');
const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const result = {};
for (const [w, tag] of [[1440, 'desktop'], [390, 'mobile']]) {
  const c = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, locale: 'ko-KR', reducedMotion: 'reduce', isMobile: w < 600 });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:5212/everyup/demo/metrics'); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: /메트릭 연결/ }).first().click(); await p.waitForTimeout(600);
  const d = p.getByRole('dialog');
  await d.getByRole('button', { name: '기존 서비스' }).click(); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(out, `setup-existing-${tag}.png`) });
  result[`existing-${tag}`] = (await d.innerText()).slice(0, 1500);
  await d.getByRole('button', { name: '새 서비스' }).click();
  await d.getByLabel('서비스 이름').fill('checkout-api-very-long-service-name-for-boundary-check-02');
  await d.getByRole('button', { name: /추가/ }).click(); await p.waitForTimeout(1200);
  await p.evaluate(() => { for (const el of document.querySelectorAll('[role=dialog] code, [role=dialog] pre')) el.textContent = el.textContent.replace(/(evup_[A-Za-z0-9_-]+|Bearer\s+\S+)/g, '****MASKED****'); });
  await p.screenshot({ path: path.join(out, `setup-result-${tag}.png`) });
  await p.addScriptTag({ path: axePath });
  result[`result-${tag}`] = {
    text: (await d.innerText()).replace(/(evup_[A-Za-z0-9_-]+|Bearer\s+\S+)/g, '****MASKED****'),
    axe: await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length }))),
  };
  await c.close();
}
await fs.writeFile(path.join(out, 'setup-flow.json'), JSON.stringify(result, null, 2));
await browser.close();
