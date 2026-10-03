// README 히어로 스크린샷 생성기. `pnpm screenshot`으로 실행한다.
//
// 데모 빌드를 미리보기로 띄우고 개요 화면을 캡처한다. 손으로 찍으면 매번 크기·
// 테마·스크롤 위치가 달라지고, UI가 바뀌어도 이미지가 낡은 걸 아무도 눈치채지
// 못한다 (실제로 README 이미지가 사이드바 개편 이전 세대에 머물러 있었다).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
// UI는 한국어 전용이라 두 파일은 같은 이미지다. 영문 README가 참조하는 -en도
// 함께 써서, 한쪽만 갱신되어 낡는 일이 없게 한다.
const OUT = ['everyup-main-ko.png', 'everyup-main-en.png'].map((name) =>
  path.resolve(here, '../../../docs/public/images/', name),
);
const PORT = 4319; // playwright(4173)/vite dev(5173)와 겹치지 않게
const URL = `http://127.0.0.1:${PORT}/everyup/demo/`;

const server = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--mode', 'demo', '--host', '127.0.0.1', '--port', String(PORT)],
  { cwd: path.resolve(here, '..'), stdio: 'ignore', shell: true },
);

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  });

  // preview 기동 대기
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try {
      await page.goto(URL, { timeout: 1000 });
      up = true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!up) throw new Error(`preview server did not come up at ${URL}`);

  // 데모 사이트 전용 UI(시나리오 스위처·배너)는 실제 설치본에 없으므로 제외한다.
  await page.addStyleTag({ content: '[data-demo-chrome] { display: none !important; }' });

  await page.waitForLoadState('networkidle');

  // 앱 셸이 h-dvh라 개요 화면은 뷰포트를 다 채우지 못하고 아래가 빈다. 실제
  // 콘텐츠 높이를 재서 뷰포트를 줄여 히어로 이미지에 여백이 남지 않게 한다.
  // 사이드바가 본문보다 길 수 있으므로 둘 중 큰 쪽에 맞춘다. 본문만 재면
  // 내비게이션 하단 항목이 잘린 채로 찍힌다.
  const fitted = await page.evaluate(() => {
    const content = document.querySelector('#main-content .p-4');
    const footer = document.querySelector('#main-content footer');
    const children = content ? [...content.children] : [];
    if (!children.length) return null;
    const bottom = Math.max(...children.map((el) => el.getBoundingClientRect().bottom));
    const footerHeight = footer ? footer.getBoundingClientRect().height : 0;
    const mainHeight = bottom + 20 /* sm:py-5 */ + footerHeight;

    // nav는 flex-1이라 늘어나므로 항목의 실제 끝을 재고, 그 아래 고정 블록만 더한다.
    const aside = document.querySelector('aside');
    const nav = aside?.querySelector('nav');
    const navItems = nav ? [...nav.children] : [];
    const navBottom = navItems.length
      ? Math.max(...navItems.map((el) => el.getBoundingClientRect().bottom))
      : 0;
    const tail = aside && aside.lastElementChild !== nav
      ? aside.lastElementChild.getBoundingClientRect().height
      : 0;
    const asideHeight = navBottom ? navBottom + tail : 0;

    return Math.ceil(Math.max(mainHeight, asideHeight));
  });
  if (fitted && fitted < 900) {
    await page.setViewportSize({ width: 1440, height: fitted });
    await page.waitForTimeout(400); // 리사이즈 후 차트 리레이아웃
  }

  const shot = await page.screenshot();
  for (const out of OUT) {
    await writeFile(out, shot);
    console.log(`wrote ${path.relative(process.cwd(), out)}`);
  }
} finally {
  await browser?.close();
  server.kill();
}
