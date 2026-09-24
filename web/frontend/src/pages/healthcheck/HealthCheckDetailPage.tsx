import { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, MaterialIcon } from '../../components/common';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { api, type AgentServiceFlat } from '../../services/api';
import { AgentHealthCheckDetailView } from '../../features/healthcheck/components/AgentHealthCheckDetailView';
import type { DetailTab } from '../../features/healthcheck/components/AgentServiceTabs';

export function HealthCheckDetailPage() {
  const { agentId, key } = useParams<{ agentId: string; key: string }>();
  const [searchParams, setSearchParams] = useSearchParams();


  const [service, setService] = useState<AgentServiceFlat | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedTab = searchParams.get('tab');
  const tab: DetailTab = selectedTab === 'uptime' || selectedTab === 'logs' || selectedTab === 'requests' || selectedTab === 'traces' || selectedTab === 'metrics' || selectedTab === 'infra'
    ? selectedTab
    : 'overview';

  const fetchService = useCallback(async () => {
    if (!agentId || !key) return;
    setLoadError(null);
    try {
      const all = await api.getAllAgentServicesFlat();
      const found = all.find((s) => s.agentId === agentId && s.key === decodeURIComponent(key));
      setService(found ?? null);
    } catch (error) {
      setService(null);
      setLoadError(error instanceof Error ? error.message : '서비스를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [agentId, key]);

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

  if (loadError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <MaterialIcon size={32} name="sync_problem" className="text-status-warn" />
        <div className="text-center"><p className="text-sm font-medium text-text-base">서비스를 불러오지 못했습니다</p><p className="mt-1 type-body text-text-muted">{loadError}</p></div>
        <div className="flex gap-2"><ButtonLink variant="secondary" to="/environments">Docker 환경</ButtonLink><Button onClick={() => void fetchService()}>다시 시도</Button></div>
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
    <AgentHealthCheckDetailView
      service={service}
      agentId={agentId!}
      serviceKey={decodeURIComponent(key!)}
      refreshKey={refreshKey}
      onRefresh={refresh}
      tab={tab}
      traceId={searchParams.get('traceId') ?? undefined}
      onTabChange={(nextTab) => {
        const next = new URLSearchParams(searchParams);
        if (nextTab === 'overview') next.delete('tab');
        else next.set('tab', nextTab);
        setSearchParams(next);
      }}
    />
  );
}
