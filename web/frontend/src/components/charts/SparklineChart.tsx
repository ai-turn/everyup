import { useId } from 'react';
import { Area, ComposedChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { CHART_INITIAL_DIMENSION, areaProps, lineProps, useChartTheme } from './chartTheme';
import { areaGradient } from './chartMarks';

// recharts를 품은 본체. Sparkline이 lazy로 불러온다 — 목록 페이지가 스파크라인 하나 때문에 recharts를 먼저 받지 않게.
export default function SparklineChart({ values }: { values: number[] }) {
  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
        <ComposedChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          {areaGradient(gradientId, theme.primaryColor)}
          <YAxis hide domain={[0, 'dataMax']} />
          <Area {...areaProps(gradientId)} dataKey="v" />
          <Line {...lineProps(theme.primaryColor, theme)} dataKey="v" activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
