// 격자 패널 차트에 키보드로 들어가 화살표를 눌렀을 때 값을 읽을 수 있는지 확인한다.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const tools = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules');
const { chromium } = await import(pathToFileURL(path.join(tools, 'playwright/index.mjs')));
const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', reducedMotion: 'reduce' });
const p = await c.newPage();
const result = {};
for (const [id, url] of [['grid', 'metrics/observed_mock_billing'], ['expanded', 'metrics/observed_mock_billing?metric=queue.messages.pending']]) {
  await p.goto('http://127.0.0.1:5212/everyup/demo/' + url); await p.waitForTimeout(1800);
  const svg = p.locator('svg[role="application"]').last();
  await svg.focus();
  const states = [];
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    await p.keyboard.press(key); await p.waitForTimeout(250);
    states.push(await p.evaluate(k => ({ key: k,
      tooltip: [...document.querySelectorAll('.recharts-tooltip-wrapper')].map(e => getComputedStyle(e).visibility + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 50)),
      cursor: document.querySelectorAll('.recharts-tooltip-cursor, .recharts-active-dot').length }), key));
  }
  // 같은 차트에 마우스를 올렸을 때의 툴팁 행 이름
  const box = await svg.boundingBox();
  await p.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.5); await p.waitForTimeout(300);
  states.push({ key: 'mouse', tooltip: await p.evaluate(() => [...document.querySelectorAll('.recharts-tooltip-wrapper')].map(e => getComputedStyle(e).visibility + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 50))) });
  result[id] = states;
  await p.screenshot({ path: path.join(out, `keyboard-${id}.png`) });
}
await fs.writeFile(path.join(out, 'chart-keyboard-arrows.json'), JSON.stringify(result, null, 2));
await browser.close();
