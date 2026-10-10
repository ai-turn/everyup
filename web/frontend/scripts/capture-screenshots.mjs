// README·docs 스크린샷 생성기. `pnpm screenshot`으로 실행한다.
//
// 데모 빌드를 미리보기로 띄우고 화면을 캡처한다. 손으로 찍으면 매번 크기·
// 테마·스크롤 위치가 달라지고, UI가 바뀌어도 이미지가 낡은 걸 아무도 눈치채지
// 못한다 (실제로 README 이미지가 사이드바 개편 이전 세대에 머물러 있었고,
// docs 캐러셀도 화면 점검 한 주 만에 전부 낡았다). UI를 바꾸면 다시 돌린다.
//
// 만드는 파일 (docs/public/images/):
// - everyup-main-ko.png — README 히어로이자 docs og:image. 라이트, 내용 높이에 맞춤
// - home/slide-<name>-<light|dark>.webp (+ -720) — docs 홈 캐러셀, 1440×900
// - quickstart-docker-env-<light|dark>.webp — Quick Start, Docker 환경 목록 1200×400 @2x
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const IMAGES = path.resolve(here, '../../../docs/public/images');
const PORT = 4319; // playwright(4173)/vite dev(5173)와 겹치지 않게
const BASE = `http://127.0.0.1:${PORT}/everyup/demo`;

// 캐러셀 순서·이름은 docs/index.md의 carousel과 같다. 알트 텍스트도 거기 있으니
// 화면 내용이 바뀌면 함께 고친다.
const SLIDES = [
  { name: 'overview', url: '/' },
  { name: 'uptime', url: '/uptime' },
  { name: 'logs', url: '/logs' },
  // 상세 화면은 헤더를 넘기고 본문(게이지·탭 내용)부터 보여준다.
  { name: 'infra', url: '/infrastructure/infra_mock_edge_01', scrollTo: '#main-content article' },
  { name: 'api', url: '/services/agent_demo_01/shop%3Aapi?tab=requests', scrollTo: '[role="tabpanel"]' },
  { name: 'trace', url: '/services/agent_demo_01/shop%3Aapi?tab=traces', click: 'POST /api/v1/payments' },
  { name: 'alerts', url: '/alerts' },
];

const server = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--mode', 'demo', '--host', '127.0.0.1', '--port', String(PORT)],
  { cwd: path.resolve(here, '..'), stdio: 'ignore', shell: true },
);

// 데모 사이트 전용 UI(시나리오 스위처·배너)는 실제 설치본에 없으므로 제외한다.
async function open(page, url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-chrome] { display: none !important; }' });
}

// 이 머신에 네이티브 이미지 도구가 없어도 되도록 Chromium canvas로 WebP를 인코딩한다.
// 절반씩 줄여 가며 축소해야 한 번에 줄일 때보다 글자가 뭉개지지 않는다.
async function writeWebp(converter, png, out, width, quality) {
  const b64 = await converter.evaluate(async ({ src, width, quality }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    let from = img, w = img.width, h = img.height;
    while (w / 2 >= width) {
      const c = Object.assign(document.createElement('canvas'), { width: w / 2, height: h / 2 });
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(from, 0, 0, c.width, c.height);
      from = c; w = c.width; h = c.height;
    }
    const c = Object.assign(document.createElement('canvas'), { width, height: Math.round(h * width / w) });
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(from, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', quality).split(',')[1];
  }, { src: `data:image/png;base64,${png.toString('base64')}`, width, quality });
  await writeFile(path.join(IMAGES, out), Buffer.from(b64, 'base64'));
  console.log(`wrote ${out}`);
}

async function captureHero(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  await open(page, '/');

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

  // UI는 한국어 전용이라 영문 README도 이 이미지를 쓴다.
  await writeFile(path.join(IMAGES, 'everyup-main-ko.png'), await page.screenshot());
  console.log('wrote everyup-main-ko.png');
  await page.close();
}

async function captureSlides(browser, converter, scheme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  for (const slide of SLIDES) {
    await open(page, slide.url);
    if (slide.scrollTo) {
      await page.locator(slide.scrollTo).first().evaluate((el) => {
        const scroller = el.closest('.overflow-y-auto');
        const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({ top: top - 20 /* sm:py-5 */, behavior: 'instant' });
      });
    }
    if (slide.click) await page.getByText(slide.click, { exact: true }).first().click();
    await page.waitForTimeout(900); // 차트 애니메이션
    const png = await page.screenshot();
    await writeWebp(converter, png, `home/slide-${slide.name}-${scheme}.webp`, 1440, 0.85);
    await writeWebp(converter, png, `home/slide-${slide.name}-${scheme}-720.webp`, 720, 0.85);
  }
  await page.close();
}

async function captureQuickstart(browser, converter, scheme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme });
  await open(page, '/environments');
  await page.waitForTimeout(800);
  const box = await page.locator('#main-content .max-w-320').first().boundingBox();
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: 1200, height: 400 } });
  await writeWebp(converter, png, `quickstart-docker-env-${scheme}.webp`, 1440, 0.88);
  await page.close();
}

let browser;
try {
  browser = await chromium.launch();

  // preview 기동 대기
  const probe = await browser.newPage();
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try {
      await probe.goto(`${BASE}/`, { timeout: 1000 });
      up = true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!up) throw new Error(`preview server did not come up at ${BASE}/`);
  await probe.goto('about:blank'); // 이후 WebP 인코딩 전용

  await captureHero(browser);
  for (const scheme of ['light', 'dark']) {
    await captureSlides(browser, probe, scheme);
    await captureQuickstart(browser, probe, scheme);
  }
} finally {
  await browser?.close();
  // shell: true라 Windows에서는 kill()이 셸만 끝내고 vite는 남는다.
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
}
