import { ReferenceArea, ReferenceLine } from 'recharts';

/* 차트 위 표시 — 컴포넌트가 아니라 요소 배열을 돌려준다: Recharts는 직계 자식만 읽으므로
 * 차트 안에 `{rangeAreas(...)}`처럼 직접 펼친다. */

/** 시간 구간 음영 — 수집 공백(`splitGaps`)이나 실패한 체크. */
export function rangeAreas(ranges: [number, number][], color: string, label: string, opacity = 0.12) {
  return ranges.map(([x1, x2]) => (
    <ReferenceArea
      key={`${label}-${x1}`}
      x1={x1}
      x2={x2}
      fill={color}
      fillOpacity={opacity}
      strokeOpacity={0}
      label={{ value: label, position: 'insideTop', fill: color, fontSize: 12 }}
    />
  ));
}

const OPERATOR_LABEL: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=' };

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
