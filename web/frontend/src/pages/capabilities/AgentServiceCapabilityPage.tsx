import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Button, ConnectionSourceBadge, EmptyState, ListToolbar, MaterialIcon, PageHeader, SearchInput,
  StatusBadge, SummaryCard,
} from '../../components/common';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeMonitorStatusBadge } from '../../features/uptime/components/UptimeMonitorStatusBadge';
import { UptimeTargetCard } from '../../features/uptime/components/UptimeTargetCard';
import { api, type AgentServiceFlat, type UptimeMonitor, type UptimeMonitorInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

function ServiceListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ))}
    </div>
  );
}


export function AgentServiceCapabilityPage() {

  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [services, configuredMonitors] = await Promise.all([
        api.getAllAgentServicesFlat(),
        api.getUptimeMonitors(),
      ]);
      setAgentServices(services ?? []);
      setMonitors(configuredMonitors ?? []);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAgentServices = useMemo(() => agentServices.filter((service) => !normalizedQuery
    || service.name.toLowerCase().includes(normalizedQuery)
    || service.agentName.toLowerCase().includes(normalizedQuery)
    || service.endpoint.toLowerCase().includes(normalizedQuery)), [agentServices, normalizedQuery]);
  const filteredMonitors = useMemo(() => monitors.filter((monitor) => !normalizedQuery
    || monitor.name.toLowerCase().includes(normalizedQuery)
    || monitor.url.toLowerCase().includes(normalizedQuery)), [monitors, normalizedQuery]);

  const saveMonitor = async (input: UptimeMonitorInput) => {
    await api.createUptimeMonitor(input);
    await load();
  };

  const setActive = async (monitor: UptimeMonitor) => {
    try {
      await api.updateUptimeMonitor(monitor.id, {
        name: monitor.name, type: monitor.type, url: monitor.type === 'http' ? monitor.url : undefined,
        host: monitor.type === 'tcp' ? monitor.url : undefined, port: monitor.port, method: monitor.method,
        expectedStatus: monitor.expectedStatus, timeout: monitor.timeout, interval: monitor.interval,
        isActive: !monitor.isActive,
      });
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const empty = filteredAgentServices.length === 0 && filteredMonitors.length === 0;

  const paused = monitors.filter((monitor) => !monitor.isActive || monitor.status === 'unknown');
  const down = monitors.filter((monitor) => monitor.isActive && monitor.status === 'unhealthy').length
    + agentServices.filter((service) => !service.healthy).length;
  const up = monitors.length + agentServices.length - paused.length - down;

  return (
    <div>
      <PageHeader title="업타임" subtitle="서비스가 정상적으로 응답하는지 확인하고, 장애가 발생한 대상을 빠르게 찾습니다.">
        <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />추가하기</Button>
      </PageHeader>

      {!loading && !error && monitors.length + agentServices.length > 0 && (
        <section aria-label="업타임 상태 요약" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="정상" value={up} detail={`전체 ${monitors.length + agentServices.length}개 대상 중`} tone="healthy" />
          <SummaryCard label="장애" value={down} detail={down === 0 ? '장애 신호 없음' : '지금 확인이 필요합니다'} tone={down === 0 ? 'idle' : 'error'} />
          <SummaryCard label="일시정지·대기" value={paused.length} detail={paused.length === 0 ? '모든 모니터 동작 중' : '체크가 돌지 않는 대상입니다'} tone="idle" />
        </section>
      )}

      <ListToolbar search={
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="서비스 또는 대상 검색" aria-label="서비스 또는 대상 검색" />
      } />

      {loading ? <ServiceListSkeleton /> : error ? (
        <EmptyState icon="error_outline" title="대상을 불러오지 못했습니다" description={error} />
      ) : empty ? (
        <EmptyState icon="monitor_heart" title={normalizedQuery ? '검색 결과가 없습니다' : '표시할 업타임 대상이 없습니다'} description={normalizedQuery ? '검색어를 바꿔 다시 시도해 보세요.' : 'Docker 환경을 연결하거나 업타임 모니터를 직접 추가해 보세요.'} />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">모니터링 대상</h2>
            <span className="font-mono text-xs text-text-dim">{filteredMonitors.length + filteredAgentServices.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredMonitors.map((monitor) => (
              <UptimeTargetCard
                key={monitor.id}
                to={`/uptime/${monitor.id}`}
                title={monitor.name}
                badge={<ConnectionSourceBadge source="direct" directLabel="직접 추가" />}
                subtitle="HTTP/TCP 모니터"
                status={<UptimeMonitorStatusBadge monitor={monitor} />}
                actions={
                  <Button size="sm" variant="secondary" aria-label={`${monitor.name} ${monitor.isActive ? '일시정지' : '재개'}`} onClick={() => void setActive(monitor)}>
                    <MaterialIcon name={monitor.isActive ? 'pause' : 'play_arrow'} />
                    {monitor.isActive ? '일시정지' : '재개'}
                  </Button>
                }
                endpoint={monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url}
                meta={<p className="text-xs text-text-muted">{monitor.type.toUpperCase()} · {monitor.interval}초</p>}
              />
            ))}
            {filteredAgentServices.map((service) => (
              <UptimeTargetCard
                key={`${service.agentId}:${service.key}`}
                to={`/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=health`}
                title={service.name}
                badge={<ConnectionSourceBadge source="docker" />}
                subtitle={service.agentName}
                status={<StatusBadge healthy={service.healthy} />}
                endpoint={service.endpoint || service.key}
              />
            ))}
          </div>
        </section>
      )}

      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={saveMonitor} />}
    </div>
  );
}
