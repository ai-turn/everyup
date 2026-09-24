import { ReferenceArea } from 'recharts';

/**
 * 시간 구간 음영 — 수집 공백(`splitGaps`)이나 실패한 체크. 컴포넌트가 아니라 요소 배열을
 * 돌려준다: Recharts는 직계 자식만 읽으므로 차트 안에 `{rangeAreas(...)}`로 직접 펼친다.
 */
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
