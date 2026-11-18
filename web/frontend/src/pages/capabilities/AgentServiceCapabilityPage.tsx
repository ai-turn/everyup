import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common';
import { UptimeMonitorList } from '../../features/uptime/components/UptimeMonitorList';
import { useUptimeMonitorList } from '../../features/uptime/useUptimeMonitorList';
import type { UptimeMonitor } from '../../services/api';

// 옛 업타임 목록(/uptime). 본문은 UptimeMonitorList가 맡고, 이 파일은 Task 13에서 삭제한다.

const UptimeListPrototype = import.meta.env.DEV ? lazy(() => import('./UptimeList.prototype').then((module) => ({ default: module.UptimeListPrototype }))) : null;

const allMonitors = () => true;
const monitorPath = (monitor: UptimeMonitor) => `/uptime/${monitor.id}`;

function PrototypeList({ variant }: { variant: string }) {
  const { monitors, loading, error } = useUptimeMonitorList(false);
  const [query, setQuery] = useState('');
  if (!UptimeListPrototype || loading) return null;
  return <Suspense fallback={<p className="p-6 text-text-muted">설계안을 불러오는 중</p>}><UptimeListPrototype variant={variant} services={[]} monitors={monitors} errors={{ monitors: error ?? undefined }} query={query} onQueryChange={setQuery} /></Suspense>;
}

export function AgentServiceCapabilityPage() {
  const [searchParams] = useSearchParams();
  const prototypeVariant = import.meta.env.DEV ? searchParams.get('variant') : null;
  if (prototypeVariant && ['B', 'C'].includes(prototypeVariant)) return <PrototypeList variant={prototypeVariant} />;

  return (
    <div className={prototypeVariant ? 'pb-36' : ''}>
      {/* 업타임은 직접 등록한 모니터만 담는다(ADR 0007). Docker Collector의 검사는 Docker 환경에서 본다. */}
      <UptimeMonitorList filter={allMonitors} hrefFor={monitorPath} renderControls={({ viewToggle, addButton, refresh }) => (
        // 갱신은 화면 전체의 조작이라 헤더에 둔다 — 데스크톱은 주 액션 앞, 모바일은 제목·추가 줄 아래(meta).
        <PageHeader menu compactActions title="업타임" meta={refresh}>
          {viewToggle}
          {addButton}
        </PageHeader>
      )} />
    </div>
  );
}
