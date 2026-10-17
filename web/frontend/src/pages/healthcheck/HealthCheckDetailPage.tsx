import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, MaterialIcon, parseTimeRange } from '../../components/common';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { api, type AgentServiceFlat } from '../../services/api';
import { AgentHealthCheckDetailView } from '../../features/healthcheck/components/AgentHealthCheckDetailView';
import type { DetailTab } from '../../features/healthcheck/components/AgentServiceTabs';
import { getErrorMessage } from '../../utils/errors';

function serviceKeyFromPath(pathname: string): string | null {
  // Read the raw segment once: router params normalize encoded slashes, which
  // would change an opaque key containing the literal text "%2F".
  const rawKey = pathname.replace(/\/$/, '').split('/').pop() ?? '';
  try { return decodeURIComponent(rawKey); } catch { return null; }
}

export function HealthCheckDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { pathname } = useLocation();
  const serviceKey = serviceKeyFromPath(pathname);
  return <HealthCheckDetail key={`${agentId}/${serviceKey}`} agentId={agentId ?? ''} serviceKey={serviceKey} />;
}

function HealthCheckDetail({ agentId, serviceKey }: { agentId: string; serviceKey: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams();


  const [service, setService] = useState<AgentServiceFlat | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedTab = searchParams.get('tab');
  const tab: DetailTab = selectedTab === 'logs' || selectedTab === 'requests' || selectedTab === 'traces' || selectedTab === 'metrics' || selectedTab === 'infra'
    ? selectedTab
    : 'uptime';

  const fetchService = useCallback(() => {
    if (pending.current) return pending.current;
    setRefreshing(true);
    const request = (async () => {
    try {
      if (serviceKey === null) { setService(null); return; }
      const all = await api.getAllAgentServicesFlat();
      const found = all.find((s) => s.agentId === agentId && s.key === serviceKey);
      setService(found ?? null);
      setLoadError(null);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    })().finally(() => { pending.current = null; });
    pending.current = request;
    return request;
  }, [agentId, serviceKey]);

  useEffect(() => { fetchService(); }, [fetchService]);

  const handleRefresh = useCallback(() => {
    fetchService();
    setRefreshKey((prev) => prev + 1);
  }, [fetchService]);

  const { refresh } = useAutoRefresh(handleRefresh, 30_000, true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-muted">
        <MaterialIcon size={24} name="sync" className="animate-spin" />
        <span>로딩 중...</span>
      </div>
    );
  }

  if (loadError && !service) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <MaterialIcon size={32} name="sync_problem" className="text-status-warn" />
        <div className="text-center"><p className="text-sm font-medium text-text-base">서비스를 불러오지 못했습니다</p><p className="mt-1 type-body text-text-muted">{loadError}</p></div>
        <div className="flex gap-2"><ButtonLink variant="secondary" to="/environments">Docker 환경</ButtonLink><Button loading={refreshing} onClick={() => void fetchService()}>다시 시도</Button></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <MaterialIcon size={32} name="error_outline" className="text-red-500" />
        <p className="text-text-muted">
          서비스를 찾을 수 없습니다
        </p>
        <ButtonLink to="/environments">
          Docker 환경으로
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
    {loadError && <div role="alert" className="mb-4 rounded-lg border border-ui-border px-4 py-3 text-sm text-text-secondary">서비스 조회에 실패했습니다. 이전에 불러온 상태입니다. <Button size="sm" variant="secondary" loading={refreshing} onClick={handleRefresh}>다시 시도</Button></div>}
    <AgentHealthCheckDetailView
      service={service}
      agentId={agentId!}
      serviceKey={serviceKey!}
      refreshKey={refreshKey}
      onRefresh={refresh}
      refreshing={refreshing}
      tab={tab}
      traceId={searchParams.get('traceId') ?? undefined}
      initialRange={parseTimeRange(searchParams.get('range'))}
      onTabChange={(nextTab) => {
        const next = new URLSearchParams(searchParams);
        if (nextTab === 'uptime') next.delete('tab');
        else next.set('tab', nextTab);
        setSearchParams(next);
      }}
    />
    </>
  );
}
