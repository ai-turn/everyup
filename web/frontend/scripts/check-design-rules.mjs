// DESIGN.md §9·§10 금지 패턴 검사. `pnpm lint`가 ESLint 다음에 돌린다.
//
// ESLint는 className 문자열 안을 보지 않고, impeccable detect는 Tailwind 임의값과
// primitive 클래스를 건너뛴다. 그래서 정규식으로 센다. 금지 규칙은 0건이어야 하고,
// 부채 규칙은 현재 건수가 상한이다(래칫) — 늘면 실패, 줄면 상한을 같이 내린다.
//
// ponytail: 줄 단위 정규식이라 문자열과 코드를 구분하지 못한다. 주석 줄만 건너뛴다.
// 오탐이 쌓이면 그때 AST(ESLint 커스텀 규칙)로 옮긴다.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

const RULES = [
  // 금지 — 0건
  { name: '§2.2 text-[Npx] 임의 크기', re: /text-\[[\d.]+(?:px|rem)\]/g },
  { name: '§1.7 hex 임의값 (ChannelForm 미리보기만 허용)', re: /\[#[0-9a-fA-F]{3,8}\]/g, skip: /ChannelForm\.tsx$/ },
  { name: '§3.2 rounded-2xl 이상', re: /\brounded-(?:2xl|3xl)\b/g },
  { name: '§2.4 400/500/700 외 굵기', re: /\bfont-(?:thin|light|semibold|extrabold|black)\b/g },
  { name: '§3.5 shadow-sm/lg 외 그림자', re: /\bshadow-(?:md|xl|2xl)\b/g },
  { name: '§9.8 confirm()', re: /\bconfirm\(/g },
  { name: '§9.9 recharts <Legend>', re: /<Legend[\s/>]/g },
  { name: '§4.1 active:scale', re: /active:scale-/g },
  { name: '§6 focus:outline-none', re: /focus:outline-none/g },
  { name: '§3.7 스케일 밖 간격 gap-2.5·3.5', re: /\bgap-(?:2|3)\.5\b/g },
  // 부채 — 현재 건수가 상한 (§10.A·§10.F)
  { name: '§1.1 *-dark 토큰 직접 사용', re: /\b(?:text|bg|border|ring|fill|stroke|outline|divide|placeholder)-[a-z-]+-dark\b/g, max: 18 },
  { name: '§10.A slate-* 하드코딩', re: /-slate-\d{2,3}\b/g, max: 78 },
  { name: '§10.A bg-white', re: /\bbg-white\b/g, max: 5 },
];

const files = readdirSync(src, { recursive: true }).filter((f) => /\.tsx?$/.test(f));
const hits = new Map(RULES.map((r) => [r, []]));

for (const file of files) {
  const lines = readFileSync(path.join(src, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
    for (const rule of RULES) {
      if (rule.skip?.test(file)) continue;
      for (const _ of line.matchAll(rule.re)) hits.get(rule).push(`${file}:${i + 1}`);
    }
  });
}

let failed = false;
for (const [rule, at] of hits) {
  const max = rule.max ?? 0;
  if (at.length > max) {
    failed = true;
    console.error(`✗ ${rule.name}: ${at.length}건 (상한 ${max})`);
    // 부채 규칙은 전체를 찍으면 수십 줄이라 파일만 모은다.
    const shown = rule.max ? [...new Set(at.map((a) => a.replace(/:\d+$/, '')))] : at;
    for (const a of shown) console.error(`    ${a}`);
  } else if (at.length < max) {
    console.log(`↓ ${rule.name}: ${at.length}건 — check-design-rules.mjs의 상한을 ${max} → ${at.length}로 내릴 것`);
  }
}

if (failed) {
  console.error('\nDESIGN.md 규칙 위반. 규칙과 근거는 web/frontend/DESIGN.md §9·§10을 볼 것.');
  process.exit(1);
}
console.log(`design rules OK (${files.length} files)`);
