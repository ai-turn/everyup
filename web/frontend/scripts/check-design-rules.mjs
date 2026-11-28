// DESIGN.md §9·§10 금지 패턴 검사. `pnpm lint`가 ESLint 다음에 돌린다.
//
// ESLint는 className 문자열 안을 보지 않고, impeccable detect는 Tailwind 임의값과
// primitive 클래스를 건너뛴다. 그래서 정규식으로 센다. 금지 규칙은 0건이어야 하고,
// 부채 규칙은 현재 건수가 상한이다(래칫) — 늘면 실패, 줄면 상한을 같이 내린다.
//
// ponytail: 줄 단위 정규식이라 문자열과 코드를 구분하지 못한다. 주석 줄만 건너뛴다.
// 함수 경계가 필요한 규칙(S5 컴포넌트 루트 여백)만 TypeScript AST로 센다.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const src = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

const RULES = [
  // 금지 — 0건
  { name: '§2.2 text-[Npx] 임의 크기', re: /text-\[[\d.]+(?:px|rem)\]/g },
  // 색 값은 tokens.css에만 있다(§1). 컴포넌트는 의미 토큰(bg-surface, text-crit-text, var(--chart-1))만 쓴다.
  // 외부 서비스 화면을 흉내 내는 채널 미리보기·채널 폼만 그 서비스의 색을 쓴다. css 파일도 센다(tokens.css 제외).
  { name: '§1 원시 색 값 (hex·rgb·hsl·oklch)', css: true, re: /(?<![\w&])#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(/g, skip: /Channel(?:Form|Preview)\.tsx$|(?:^|[\\/])tokens\.css$/ },
  // Tailwind 기본 팔레트는 index.css가 지웠다(--color-*: initial). 써도 아무것도 생성되지 않는다.
  { name: '§1 Tailwind 기본 팔레트', re: /(?<![\w-])(?:bg|text|border(?:-[trblxyse])?|ring|fill|stroke|outline|divide|placeholder|from|to|via|shadow|accent|caret|decoration)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?![\w-])/g },
  // dark: 변형은 테마 두 개만 가리킨다. 테마는 토큰이 바꾸므로 쓰지 않는다(채널 미리보기만 허용).
  { name: '§1.1 dark: 변형', re: /(?<![\w-])dark:/g, skip: /ChannelPreview\.tsx$/ },
  { name: '§3.2 rounded-2xl 이상', re: /\brounded-(?:2xl|3xl)\b/g },
  { name: '§2.4 400/500/700 외 굵기', re: /\bfont-(?:thin|light|semibold|extrabold|black)\b/g },
  { name: '§3.5 shadow-sm/lg 외 그림자', re: /\bshadow-(?:md|xl|2xl)\b/g },
  { name: '§9.8 confirm()', re: /\bconfirm\(/g },
  { name: '§9.9 recharts <Legend>', re: /<Legend[\s/>]/g },
  { name: '§4.1 active:scale', re: /active:scale-/g },
  { name: '§6 focus:outline-none', re: /focus:outline-none/g },
  { name: '§3.7 스케일 밖 간격 gap-2.5·3.5', re: /\bgap-(?:2|3)\.5\b/g },
  { name: '§2.5 uppercase (채널 미리보기만 허용)', re: /\buppercase\b/g, skip: /ChannelPreview\.tsx$/ },
  { name: '§2.5 tracking-wide 이상', re: /\btracking-(?:wide|wider|widest)\b/g },
  { name: '§2.5 마침표 셋 (… 사용)', re: /[^.]\.\.\.(?=['"`<]|\s*$)/g },
  { name: '§9.16 transition-all', re: /\btransition-all\b/g },
  // 글자 역할 토큰(crit-text 등)을 채움에 쓰지 않는다. 채움은 crit·attn·ok·wait, 옅은 바탕은 *-bg다.
  { name: '§1.4 상태 채움에 글자 토큰', re: /\bbg-(?:crit|attn|ok)-text\b/g },
  // 크기·굵기는 역할 유틸리티로 고른다(§2.2). 같은 모양의 조합을 손으로 쓰면 역할 표에서 빠진다.
  { name: '§2.2 text-sm/xs + font-medium (type-label/-sm)', re: /\btext-(?:sm|xs) font-medium\b|\bfont-medium text-(?:sm|xs)\b/g },
  { name: '§2.2 역할 유틸리티 위에 굵기 덧씌움', re: /\btype-[a-z-]+\b[^"'`]*\bfont-(?:normal|medium|semibold|bold)\b/g },
  // 부채 — 현재 건수가 상한 (§10.A·§10.F)
  // 18px 이상 원시 크기: 로고 워드마크 둘·로그인 워드마크·모바일 설정 h1·404 숫자만. 숫자는 type-kpi/stat(§2.2)
  { name: '§2.2 text-lg 이상 원시 크기', re: /\btext-(?:lg|xl|[2-6]xl)\b/g, max: 5 },
  // 간격 체계(§3.7, §10.I) — 2026-11-21 P0~P5에서 래칫으로 0건까지 내리고 P6에서 금지로 옮겼다.
  // S1 임의값 간격. 뷰포트 비율(명령 팔레트의 pt-[18vh])만 허용한다.
  { name: '§3.7 S1 임의값 간격', re: /(?<![\w-])-?(?:m[trblxyse]?|p[trblxyse]?|gap(?:-[xy])?|space-[xy])-\[/g, skip: /CommandPalette\.tsx$/ },
  // S2 블록 사이 세로 반 단계: 여백·space-y·gap-y만 센다. 상자 안쪽 패딩(컨트롤·칩·안내 상자)은 컴포넌트 안쪽 값이고,
  // 음수 여백은 bleed 보정이라 세지 않는다. 줄 상자 보정 mt-0.5는 S3이 센다.
  { name: '§3.7 S2 세로 반 단계', re: /(?<![\w-])(?:(?:space-y|gap-y|mb|my)-\d+\.5|mt-[1-9]\d*\.5)(?![\w.])/g, skip: /ChannelPreview\.tsx$/ },
  // S3 줄 상자 보정(mt-0.5)은 담당 프리미티브(components/common, ListRow 둘째 줄) 안에만 둔다. 제목 → 설명은 mt-intra,
  // 첫 줄 맞춤은 icon-lead다. 컨트롤·칩·상자 안쪽 패딩(py-2.5)은 S2와 같은 이유로 세지 않는다(표 칸은 cell).
  { name: '§3.7 S3 화면 코드의 mt-0.5', re: /(?<![\w-])mt-0\.5(?![\w.])/g, skip: /components[\\/]common[\\/]|ChannelPreview\.tsx$/ },
  // S4 여백만 가진 감싸개. 간격은 부모의 gap·space-y가 정한다. 밀어내기(ml-auto 등)와 음수 여백(bleed 보정)은 간격이 아니라 뺀다.
  { name: '§3.7 S4 여백만 가진 감싸개', re: /className="(?:m[trblxyse]?-(?!auto\b)[\w.]+ ?)+"/g },
  // S6 역할 없는 글자 크기(같은 클래스 문자열에 type-*·font-mono가 없다). 화면 코드만 센다: 프리미티브(components/common)의
  // 크기 표(Button sm/md 등)는 컴포넌트 안쪽 값이고, 접두사가 붙은 크기(max-sm:text-base 입력의 iOS 확대 방지, focus:)는 컨트롤
  // 조정이다. 채널 미리보기는 외부 서비스 흉내라 뺀다.
  { name: '§2.2 S6 역할 없는 text-xs/sm/base', strings: true, re: /(?<![\w:-])text-(?:xs|sm|base)(?![\w-])/g, unless: /(?<![\w-])(?:type-[a-z-]+|font-mono)(?![\w-])/, skip: /components[\\/]common[\\/]|ChannelPreview\.tsx$/ },
  // S7 행간 직접 지정. 행간은 type-* 역할이 정한다. 프리미티브 안쪽(MaterialIcon의 leading-none, 툴팁)과 로고 워드마크(Header)는 뺀다.
  { name: '§2.2 S7 leading-* 직접 지정', re: /(?<![\w-])leading-[\w.[\]]+/g, skip: /components[\\/]common[\\/]|components[\\/]layout[\\/]Header\.tsx$|ChannelPreview\.tsx$/ },
  // S8 숫자 세로 간격. 쌓기(space-y, flex-col의 gap)는 관계 토큰(gap-heading 등)으로 쓴다.
  { name: '§3.7 S8 숫자 세로 간격', strings: true, re: /(?<![\w-])space-y-\d+(?:\.5)?(?![\w.])/g, also: { when: /(?<![\w-])flex-col(?![\w-])/, re: /(?<![\w-])gap-\d+(?:\.5)?(?![\w.])/g }, skip: /ChannelPreview\.tsx$/ },
];

// S5 컴포넌트 루트의 바깥 여백(음수 bleed·auto 제외). 정규식으로는 함수 경계를 모르므로 TypeScript AST로 센다.
// 이름이 대문자로 시작하는 함수(컴포넌트)가 직접 반환하는 JSX 요소의 className 리터럴을 본다. 조건식으로 고르는 루트는 보지 않는다.
const S5 = { name: '§3.7 S5 컴포넌트 루트 여백' };
const ROOT_MARGIN = /(?:^|\s)(?:[\w-]+:)*m[trblxyse]?-(?!auto(?![\w-]))[\w.[\]]+/;
function rootMargins(file, text) {
  const hits = [];
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const classText = (attr) => {
    let e = attr.initializer;
    if (e && ts.isJsxExpression(e)) e = e.expression;
    if (!e) return '';
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e)) return [e.head.text, ...e.templateSpans.map((span) => span.literal.text)].join(' ');
    return '';
  };
  const check = (fn) => {
    const report = (expr) => {
      while (expr && ts.isParenthesizedExpression(expr)) expr = expr.expression;
      const opening = expr && (ts.isJsxElement(expr) ? expr.openingElement : ts.isJsxSelfClosingElement(expr) ? expr : null);
      const attr = opening?.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'className');
      const m = attr && classText(attr).match(ROOT_MARGIN);
      if (m) hits.push(`${file}:${sf.getLineAndCharacterOfPosition(opening.getStart(sf)).line + 1} ${m[0].trim()}`);
    };
    if (!fn.body) return;
    if (!ts.isBlock(fn.body)) return report(fn.body);
    const visit = (node) => {
      if (ts.isFunctionLike(node)) return; // 안쪽 함수의 return은 이 컴포넌트의 루트가 아니다
      if (ts.isReturnStatement(node)) report(node.expression);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(fn.body, visit);
  };
  const walk = (node) => {
    if (ts.isFunctionDeclaration(node) && /^[A-Z]/.test(node.name?.text ?? '')) check(node);
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text) && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) check(node.initializer);
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return hits;
}

const files = readdirSync(src, { recursive: true }).filter((f) => /\.(?:tsx?|css)$/.test(f));
const hits = new Map(RULES.map((r) => [r, []]));

hits.set(S5, []);
for (const file of files) {
  const text = readFileSync(path.join(src, file), 'utf8');
  text.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
    // strings 규칙은 줄 안의 따옴표·백틱 문자열(클래스 문자열) 하나씩을 본다.
    const strings = [...line.matchAll(/(["'`])((?:(?!\1).)*)\1/g)].map((m) => m[2]);
    for (const rule of RULES) {
      if (rule.skip?.test(file) || (file.endsWith('.css') && !rule.css)) continue;
      for (const target of rule.strings ? strings.filter((str) => !rule.unless?.test(str)) : [line]) {
        for (const _ of target.matchAll(rule.re)) hits.get(rule).push(`${file}:${i + 1}`);
        if (rule.also?.when.test(target)) for (const _ of target.matchAll(rule.also.re)) hits.get(rule).push(`${file}:${i + 1}`);
      }
    }
  });
  if (file.endsWith('.tsx')) hits.get(S5).push(...rootMargins(file, text));
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
