import { useId } from 'react';
import { Area, ComposedChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { CHART_INITIAL_DIMENSION, areaProps, lineProps, useChartTheme } from './chartTheme';
import { areaGradient } from './chartMarks';

/** 축 없는 추세선. 값만 있고 시각은 없다 — 시간 위치가 중요한 자리에는 쓰지 않는다. */
export function Sparkline({ values }: { values: number[] }) {
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
