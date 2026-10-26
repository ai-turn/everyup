import { lazy, Suspense } from 'react';

const SparklineChart = lazy(() => import('./SparklineChart'));

/** 축 없는 추세선. 값만 있고 시각은 없다 — 시간 위치가 중요한 자리에는 쓰지 않는다. */
export function Sparkline({ values }: { values: number[] }) {
  // 자리를 먼저 잡아 두어 차트가 도착해도 행 높이가 흔들리지 않는다.
  return (
    <Suspense fallback={<div className="h-8 w-full" aria-hidden="true" />}>
      <SparklineChart values={values} />
    </Suspense>
  );
}
