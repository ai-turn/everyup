import { useSyncExternalStore } from 'react';

export interface ChartTheme {
  gridColor: string;
  tickColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  /** Brand primary for chart series — follows the light/dark CSS token. */
  primaryColor: string;
  /** status-error — failed-check ranges and alert thresholds. */
  errorColor: string;
}

export interface TooltipPayloadItem {
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  /** Overrides ChartTooltip's `unit` for this row. */
  unit?: string;
}

// Recharts otherwise renders once with its -1×-1 sentinel before the first
// ResizeObserver callback, which produces a console warning in lazy routes.
export const CHART_INITIAL_DIMENSION = { width: 1, height: 1 } as const;

function getCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ── EveryUp 차트 스펙 (Grafana풍) ────────────────────────────────
 * 모든 recharts 차트는 아래 팩토리/상수를 사용한다. 개별 차트에서
 * 선 굵기·그리드·축 스타일을 다시 정의하지 말 것.
 * 규칙: 첫 시리즈=프라이머리, monotoneX+둥근 캡, 얇은 1.5px 라인,
 *       단일 시리즈만 아래로 옅어지는 채움, 얕은 실선 그리드, medium 12px 눈금,
 *       숫자 시간축(정시 눈금·24시간제), 수집 공백은 선을 끊는다, 애니메이션 없음.
 *       통계: 단일 시리즈는 카드 제목 옆 ChartSummary, 다중 시리즈는 ChartStatsLegend. */

/* 시리즈 hex 단일 소스 — 정적 컨텍스트(데이터 변환 등)용. 컴포넌트에서는 getSeriesPalette 사용.
 *
 * 500단계였을 때 라이트 배경 대비가 emerald 2.54 / teal 2.49 / amber 2.15로 WCAG 1.4.11(3:1)
 * 미달이었다 — 팔레트가 다크 배경만 보고 튜닝돼 있었다. 600단계로 내려 양쪽 다 통과시킨다.
 *
 * 적록색각이상 하에서 앞 3슬롯(primary/emerald/amber)은 서로 구분되지만 4슬롯째부터는
 * 어떤 순서로 배열해도 충돌한다(primary/violet 16.0, emerald/teal 11.8, amber/red 12.8).
 * 시리즈가 4개를 넘으면 색만으로 구분이 보장되지 않는다 — 선 스타일이나 직접 라벨 병행. */
export const SERIES_HEX = {
  primary: '#3b76c9',
  emerald: '#059669',
  amber: '#d97706',
  violet: '#7c3aed',
  red: '#dc2626',
  teal: '#0d9488',
} as const;

/** 다중 시리즈 순환 팔레트 — 첫 슬롯은 항상 브랜드 프라이머리. */
export function getSeriesPalette(theme: ChartTheme): string[] {
  return [theme.primaryColor, SERIES_HEX.emerald, SERIES_HEX.amber, SERIES_HEX.violet, SERIES_HEX.red, SERIES_HEX.teal];
}

/* 4슬롯째부터 선 스타일을 달리한다 — 그 지점부터 색만으로는 구분이 보장되지 않기 때문이다(위 주석).
 * 앞 3슬롯은 적록색각이상에서도 서로 구분되므로 실선을 유지해, 시리즈가 1~3개인 대다수 차트의
 * 모습은 그대로 둔다. 시리즈 개수가 데이터에 달린 차트에서만 4번째 이후가 파선으로 갈린다. */
const DASH_PATTERNS = ['6 3', '2 2', '8 3 2 3'] as const;

export function getSeriesDash(index: number): string | undefined {
  return index < 3 ? undefined : DASH_PATTERNS[(index - 3) % DASH_PATTERNS.length];
}

/** 차트 높이는 두 가지뿐 — 일반 차트, 그리고 목록 위에 붙는 막대 띠(로그 발생량). */
export const CHART_HEIGHT = 220;
export const CHART_STRIP_HEIGHT = 120;

/** 차트 카드 공통 클래스 — 패딩(p-4/p-6)은 소비처에서 붙인다. */
export const chartCardClass =
  'rounded-xl border border-ui-border bg-bg-surface';

export function gridProps(theme: ChartTheme) {
  return { stroke: theme.gridColor, strokeOpacity: 0.55, vertical: false } as const;
}

export function xAxisProps(theme: ChartTheme) {
  return {
    tick: { fill: theme.tickColor, fontSize: 12, fontWeight: 500 },
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    interval: 'preserveStartEnd',
  } as const;
}

export function yAxisProps(theme: ChartTheme, width = 44) {
  return {
    tick: { fill: theme.tickColor, fontSize: 12, fontWeight: 500 },
    tickLine: false,
    axisLine: false,
    width,
  } as const;
}

export function tooltipCursor(theme: ChartTheme) {
  return { stroke: theme.gridColor, strokeWidth: 1, strokeDasharray: '4 4' } as const;
}

/* monotoneX는 모든 표본점을 정확히 지나고 점 사이에서 위아래로 튀어나가지 않는다 — 값은 그대로
 * 두고 모서리만 둥글린다. 직선(linear)은 30분 간격 같은 성긴 표본에서 각진 꺾은선이 되어
 * 조잡해 보였다(2026-09-24 되돌림).
 * connectNulls를 끄는 것은 splitGaps가 넣은 빈 행에서 선을 끊기 위해서다. */
export function lineProps(color: string, theme: ChartTheme) {
  return {
    type: 'monotoneX',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    dot: false,
    // 링은 표면색 — 흰색 고정이면 다크 카드 위에서 흰 테가 번쩍인다.
    activeDot: { r: 4, stroke: theme.tooltipBg, strokeWidth: 2, fill: color },
    connectNulls: false,
    isAnimationActive: false,
  } as const;
}

/**
 * 라인 아래 채움 — 선은 별도 Line으로 그린다. 위 18%에서 바닥 0%로 옅어진다(`areaGradient`와 짝):
 * 평면 채움은 값이 높을수록 차트 전체를 덮는 파란 판이 됐다. 시리즈가 2개 이상이면 쓰지 않는다.
 */
export function areaProps(gradientId: string) {
  return {
    type: 'monotoneX',
    stroke: 'none',
    fill: `url(#${gradientId})`,
    // 채움은 장식이다 — 툴팁 행은 같은 dataKey의 Line이 이름과 함께 낸다.
    tooltipType: 'none',
    isAnimationActive: false,
  } as const;
}

export function getChartTheme(): ChartTheme {
  return {
    gridColor: getCssVar('--color-chart-border') || '#e2e8f0',
    // text-muted is the AA-safe chart label token in both themes. Never read
    // the implementation-only *-dark variables here.
    tickColor: getCssVar('--color-text-muted') || '#475569',
    tooltipBg: getCssVar('--color-bg-surface') || '#ffffff',
    tooltipBorder: getCssVar('--color-chart-border') || '#e2e8f0',
    primaryColor: getCssVar('--color-primary') || SERIES_HEX.primary,
    errorColor: getCssVar('--color-status-error') || '#b91c1c',
  };
}

// ThemeProvider는 렌더가 끝난 뒤 effect에서 <html>.dark를 토글한다. 그래서 테마 값을
// 구독해도 자식 렌더 시점에는 CSS 변수가 아직 이전 값이다 — 클래스 변경 자체를 구독해야
// 전환 직후 한 번 더 그려진다.
function subscribeThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const isDarkClass = () => document.documentElement.classList.contains('dark');

/** getChartTheme()의 훅 버전 — 테마가 바뀌면 차트를 다시 그린다. 컴포넌트에서는 이것을 쓴다. */
export function useChartTheme(): ChartTheme {
  useSyncExternalStore(subscribeThemeClass, isDarkClass);
  return getChartTheme();
}

/* ── Y축: nice tick ─────────────────────────────────────────────
 * 최댓값만 보고 1·2·2.5·5×10ⁿ 간격을 고른다 — 0·25·50·75·100, 0·10·20·30.
 * recharts 기본 눈금은 도메인을 균등 분할해 0·8.75·17.5·26.25·35 같은 값이 나온다. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const steps = Math.ceil(max / step - 1e-9);
  return Array.from({ length: steps + 1 }, (_, i) => Number((i * step).toPrecision(12)));
}

/** YAxis에 스프레드 — `<YAxis {...yAxisProps(theme)} {...niceYAxis(max)} />` */
export function niceYAxis(max: number) {
  const ticks = niceTicks(max);
  return { domain: [0, ticks[ticks.length - 1]] as [number, number], ticks, interval: 0 } as const;
}

/* ── X축: 숫자 시간축 ───────────────────────────────────────────
 * 문자열 라벨(카테고리) 축은 행을 균등 간격으로 늘어놓는다. 그러면 수집이 끊긴 구간이
 * 이어 붙어 사라지고, 눈금이 14:21처럼 첫 행 시각에 끌려간다. 행에 `t`(epoch ms)를
 * 두고 시간 스케일로 그린다. */
const MINUTE = 60_000;
const TICK_STEPS = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * MINUTE);

/** 현지 시각의 정시·정분에 맞춘 눈금 — 8개 이하. */
export function timeTicks(from: number, to: number): number[] {
  const step = TICK_STEPS.find((s) => (to - from) / s <= 8) ?? TICK_STEPS[TICK_STEPS.length - 1];
  // ponytail: 시작 시각의 UTC 오프셋 하나로 정렬한다 — 범위 안에서 DST가 바뀌면 한 시간 어긋난다.
  const local = -new Date(from).getTimezoneOffset() * MINUTE;
  const ticks: number[] = [];
  for (let t = Math.ceil((from + local) / step) * step - local; t <= to; t += step) ticks.push(t);
  return ticks;
}

const TICK_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
export const formatTimeTick = (t: number) => new Date(t).toLocaleTimeString('ko-KR', TICK_FORMAT);
/** 툴팁 제목 — "9월 24일 (목) 18:31". 24시간 범위는 자정을 넘기므로 날짜가 있어야 한다. */
export const formatTimeLabel = (t: number) =>
  new Date(t).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', ...TICK_FORMAT });

/** 시간축 XAxis — 데이터 행의 `t`를 쓴다. domain은 조회한 창([from, to])이다. */
export function timeXAxisProps(theme: ChartTheme, [from, to]: [number, number]) {
  return {
    ...xAxisProps(theme),
    dataKey: 't',
    type: 'number',
    scale: 'time',
    domain: [from, to],
    // 창 밖 데이터는 잘라낸다 — 도메인을 데이터에 맞춰 늘리면 눈금(창 기준)이 한쪽으로 몰린다.
    allowDataOverflow: true,
    ticks: timeTicks(from, to),
    tickFormatter: formatTimeTick,
  } as const;
}

function medianStep(times: number[]): number {
  const diffs = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] ?? 0;
}

/** 수집 공백 — 간격이 평소(step, 없으면 중앙값)의 2배를 넘는 곳에 값 없는 행을 넣어 선을 끊고, 그 구간을 돌려준다. */
export function splitGaps<T extends { t: number }>(rows: T[], step = medianStep(rows.map((r) => r.t))) {
  const out: (T | { t: number })[] = [];
  const gaps: [number, number][] = [];
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    if (prev && step > 0 && row.t - prev.t > 2 * step) {
      out.push({ t: prev.t + step });
      gaps.push([prev.t, row.t]);
    }
    out.push(row);
  });
  return { rows: out, gaps };
}

/**
 * 조건에 맞는 행이 이어진 구간 — 실패한 체크 음영용. 각 행은 다음 행까지를 덮고, 그 행에서
 * 선이 끊겼다면(`breaksLine`) 앞 행까지 넓힌다: 끊긴 선의 양 끝에 음영이 맞닿아야 선과
 * 음영 사이에 흰 틈이 생기지 않는다.
 */
export function runRanges<T extends { t: number }>(rows: T[], hit: (row: T) => boolean, breaksLine = hit): [number, number][] {
  const out: [number, number][] = [];
  rows.forEach((row, i) => {
    if (!hit(row)) return;
    const from = breaksLine(row) ? rows[i - 1]?.t ?? row.t : row.t;
    const to = rows[i + 1]?.t ?? row.t;
    const last = out[out.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  });
  return out;
}

/** 빈 버킷 채우기 — 서버는 데이터가 있는 버킷만 준다. 건수 차트에서 비어 있는 버킷은 "0건"이지 "모름"이 아니다. */
export function fillBuckets<T extends { t: number }>(rows: T[], [from, to]: [number, number], step: number, empty: (t: number) => T): T[] {
  // 서버 버킷은 폭의 배수에 정렬돼 있다 — 슬롯으로 내려 맞추면 정렬되지 않은 입력에도 어긋나지 않는다.
  const bySlot = new Map(rows.map((row) => [Math.floor(row.t / step) * step, row]));
  const out: T[] = [];
  for (let t = Math.floor(from / step) * step; t <= to; t += step) {
    const row = bySlot.get(t);
    out.push(row ? { ...row, t } : empty(t));
  }
  return out;
}

export function formatAxisValue(value: number, unit?: string): string {
  if (unit === '%') return String(Math.round(value));
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  // nice tick은 대부분 정수다 — 0을 "0.00", 2를 "2.0"으로 쓰지 않는다.
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Math.abs(value) >= 10) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatMetricValue(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/* ── OTel 단위 → 표시 단위 ─────────────────────────────────────
 * OTel은 UCUM 기본 단위로 보낸다 — 시간은 s, 크기는 By. 그대로 그리면 0.05s 같은 소수가 되고,
 * 바이트는 10진 nice tick을 2진으로 찍어 95.4MB · 190.7MB 눈금이 된다. 값에 factor를 먼저 곱한 뒤
 * 눈금·통계·툴팁을 모두 표시 단위로 계산한다. */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function metricDisplayUnit(unit: string, max: number): { unit: string; factor: number } {
  if (unit === 'By') {
    const i = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(Math.max(max, 1)) / Math.log(1024)));
    return { unit: BYTE_UNITS[i], factor: 1024 ** -i };
  }
  if (unit === 's' && max < 1) return { unit: 'ms', factor: 1000 };
  if (unit === 'ms' && max >= 1000) return { unit: 's', factor: 0.001 };
  // "1"은 무차원, {request} 같은 중괄호는 UCUM 주석 — 둘 다 단위가 아니다.
  if (unit === '1' || /^\{.*\}$/.test(unit)) return { unit: '', factor: 1 };
  return { unit, factor: 1 };
}
