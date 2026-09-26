import { ReferenceArea, ReferenceLine } from 'recharts';

/* 차트 위 표시 — 컴포넌트가 아니라 요소 배열을 돌려준다: Recharts는 직계 자식만 읽으므로
 * 차트 안에 `{rangeAreas(...)}`처럼 직접 펼친다. */

/**
 * 시간 구간 음영 — 수집 공백(`splitGaps`). 글자 라벨은 달지 않는다: 좁은 띠 위의 빨간 글씨는
 * 스티커처럼 떠 보였다. 무엇인지는 카드 제목 줄(예: 실패 2회)이 말한다.
 */
export function rangeAreas(ranges: [number, number][], color: string, opacity = 0.1) {
  return ranges.map(([x1, x2]) => (
    <ReferenceArea key={x1} x1={x1} x2={x2} fill={color} fillOpacity={opacity} strokeOpacity={0} />
  ));
}

/** `areaProps(id)`가 가리키는 세로 그라데이션 — 차트 안에 `{areaGradient(id, color)}`로 펼친다. */
export function areaGradient(id: string, color: string) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.18} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

export const OPERATOR_LABEL: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=' };

/** 알림 규칙 임계값 — 점선. 점선은 그리드(실선)와 구분돼 "선을 넘으면 알림"으로 읽힌다. */
export function thresholdLines(rules: { id: string; operator: string; threshold: number }[], color: string, unit = '') {
  return rules.map((rule) => (
    <ReferenceLine
      key={rule.id}
      y={rule.threshold}
      stroke={color}
      strokeDasharray="5 4"
      label={{ value: `알림 ${OPERATOR_LABEL[rule.operator] ?? '>'} ${rule.threshold}${unit}`, position: 'insideTopRight', fill: color, fontSize: 12 }}
    />
  ));
}
