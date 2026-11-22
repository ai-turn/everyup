import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ListViewToggle } from '../../components/common';
import { useInfraMetrics } from '../../hooks/useInfra';
import { useListView } from '../../hooks/useListView';
import { api, type AgentServiceFlat, type LogPattern, type LogServiceSummary } from '../../services/api';
import { AgentServiceRequestTrends } from '../healthcheck/components/AgentServiceRequestTrends';
import { InfraGauges } from '../infra/components/InfraGauges';
import { LogServiceOverview } from '../logs/components/LogServiceOverview';
import { logScopeKey, withLogSummaries } from '../logs/logServiceRows';
import { containerPath } from './dockerPaths';

// 서버 탭 안에서 Docker Collector가 수집한 데이터를 그리는 구역들(ADR 0012). 옛 Docker 환경 화면의 인프라·로그·API 요청 탭과 같다.

/** Docker Collector가 수집한 호스트 지표. 인프라를 수집할 때만 그려야 지표를 요청한다. */
export function DockerHostGauges({ hostId, refreshKey }: { hostId: string; refreshKey: number }) {
  const { data, loading } = useInfraMetrics(hostId, '6h', refreshKey);
  return <InfraGauges gauges={data?.gauges} loading={loading} />;
}

/** 컨테이너 로그의 24시간 요약과 반복 패턴. */
export function DockerLogsSection({ serverId, agentId, containers, refreshKey }: { serverId: string; agentId: string; containers: AgentServiceFlat[]; refreshKey: number }) {
  const { view, setView, returnTo } = useListView();
  const [data, setData] = useState<{ summaries: LogServiceSummary[]; patterns: LogPattern[] } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([api.getLogSummary(), api.getLogPatterns({ agentId })])
      .then(([summaries, patterns]) => { if (alive) setData({ summaries: summaries ?? [], patterns: patterns ?? [] }); }, () => {});
    return () => { alive = false; };
  }, [agentId, refreshKey]);
  const overview = useMemo(() => data && withLogSummaries(
    containers.map((service) => ({
      key: logScopeKey({ agentId, serviceName: service.name }),
      name: service.name,
      subtitle: service.runtime ?? service.checkType,
      to: `${containerPath(serverId, service.key)}?tab=logs&range=24h`,
    })),
    data.summaries,
    data.patterns,
  ), [data, containers, agentId, serverId]);
  if (!overview) return <EmptyState icon="sync" title="로그 요약을 불러오는 중입니다" headingLevel="h2" />;
  return <LogServiceOverview rows={overview.rows} patterns={overview.patterns} span={overview.span} view={view} returnTo={returnTo}
    title="컨테이너 로그" noun="컨테이너" viewToggle={<ListViewToggle view={view} onChange={setView} />} />;
}

/** 모든 컨테이너의 요청을 합친 추이(eBPF Observer). */
export function DockerRequestsSection({ agentId, refreshKey }: { agentId: string; refreshKey: number }) {
  return <AgentServiceRequestTrends agentId={agentId} refreshKey={refreshKey}
    empty={<EmptyState icon="show_chart" title="최근 요청이 없습니다" description="컨테이너가 요청을 받으면 여기에 추이가 나타납니다." headingLevel="h2" />} />;
}
