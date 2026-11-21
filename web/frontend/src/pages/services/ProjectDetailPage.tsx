import { Tooltip } from '../../components/common/Tooltip';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { MaterialIcon } from '../../components/common/MaterialIcon';
import { Button, DetailMeta, EmptyState, List, ListRow, ListViewToggle, PageHeader, RefreshIconButton, ResourceCardHeader, ResourceTable, Section, Tabs, tabId, tabPanelId, type TabItem } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { DockerUptimeStatus } from '../../features/uptime/components/DockerUptimeStatus';
import { CollectionStatusBadge } from '../../components/common/CollectionStatusBadge';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import {
  api,
  type AgentServiceFlat, type ConnectedAgent, type AgentIncident,
  type AgentEvent, type OtelServiceMetric, type AgentCollectionCapability,
  type LogServiceSummary, type LogPattern,
} from '../../services/api';
import { InfraGauges } from '../../features/infra/components/InfraGauges';
import { useInfraMetrics } from '../../hooks/useInfra';
import { LogServiceOverview } from '../../features/logs/components/LogServiceOverview';
import { logScopeKey, withLogSummaries } from '../../features/logs/logServiceRows';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { MonitoringSetupPanel } from '../../features/services/components/MonitoringSetupPanel';
import { CollectorCapabilityDialog } from '../../features/services/components/CollectorCapabilityDialog';
import { AgentServiceRequestTrends } from '../../features/healthcheck/components/AgentServiceRequestTrends';
import { AgentCheckHistoryBar } from '../../features/healthcheck/components/AgentCheckHistoryBar';
import { getErrorMessage } from '../../utils/errors';
import { formatClock, formatDuration, formatIncidentTime } from '../../utils/incidentFormat';

// 인프라를 수집할 때만 그려져야 지표를 받는다 — 페이지 본체에서 훅을 부르면 항상 요청한다.
function HostGauges({ hostId, refreshKey }: { hostId: string; refreshKey: number }) {
  const { data, loading } = useInfraMetrics(hostId, '6h', refreshKey);
  return <InfraGauges gauges={data?.gauges} loading={loading} />;
}

// 서버 상세처럼 주소로 고르는 탭이다. 개요가 기본이라 주소에 탭이 없다(`/agents/:id`).
type EnvTab = 'overview' | 'infrastructure' | 'logs' | 'api';
const ID_PREFIX = 'docker-env';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}


// Formats a representative metric value; OTel bytes ("By") as KB/MB/GB, else a
// rounded number with its unit appended.
function formatMetricValue(v: number, unit?: string): string {
  if (unit === 'By') {
    const abs = Math.abs(v);
    if (abs >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)}GB`;
    if (abs >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)}MB`;
    if (abs >= 1024) return `${(v / 1024).toFixed(1)}KB`;
    return `${Math.round(v)}B`;
  }
  const r = Math.round(v * 100) / 100;
  return unit && unit !== '1' ? `${r}${unit}` : String(r);
}

// Compact label from a dotted metric name, e.g. "jvm.memory.used" → "memory.used".
function metricLabel(name: string): string {
  return name.split('.').slice(-2).join('.');
}

// One service in the project overview grid. Current health/latency/status come
// straight from the flat snapshot (no extra fetch). The representative metric,
// when present, is the service's most telling exported OTel metric. Click →
// full service detail.
function ServiceCard({ service, metric, to, returnTo }: {
  service: AgentServiceFlat;
  metric?: OtelServiceMetric;
  to: string;
  returnTo: string;
}) {

  return (
    <Link
      to={to}
      state={{ returnTo }}
      aria-label={service.name}
      className="card-interactive group bg-bg-surface border border-ui-border-soft rounded-xl p-4 flex flex-col gap-3"
    >
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{service.name}</h3>}
        subtitle={service.runtime ?? service.checkType}
        status={<DockerUptimeStatus service={service} />}
      />

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="min-w-0">
          <div className="text-xs text-text-dim">응답 시간</div>
          <div className="font-medium text-text-base truncate">{service.lastLatency ?? '-'}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-text-dim">상태</div>
          <div className={`${service.healthy ? 'text-status-healthy' : 'text-status-error'}`}>
            {service.lastStatus ?? '-'}
          </div>
        </div>
        {metric && (
          <div className="min-w-0">
            <Tooltip content={metric.metricName}><div className="text-xs text-text-dim truncate">
              {metricLabel(metric.metricName)}
            </div></Tooltip>
            <div className="font-medium text-text-base truncate">
              {formatMetricValue(metric.value, metric.unit)}
            </div>
          </div>
        )}
      </div>

      {!service.healthy && service.lastError && (
        <p className="text-xs text-status-error truncate -mt-1">{service.lastError}</p>
      )}
    </Link>
  );
}

// Project overview: aggregate header + service health grid. Individual service
// detail lives at /services/:agentId/:key (linked from the sidebar tree too).
export function ProjectDetailPage() {
  const { view, setView, returnTo } = useListView();
  const { agentId, tab } = useParams<{ agentId: string; tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();


  const [agent, setAgent] = useState<ConnectedAgent | null>(null);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showInstrumentation, setShowInstrumentation] = useState(false);
  const [addingCapability, setAddingCapability] = useState<AgentCollectionCapability | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const headerName = agent?.name ?? services[0]?.agentName ?? '';
  useBreadcrumb(headerName ? [{ label: headerName }] : []);

  // Dashboard aggregates — non-critical, each fails independent of the main load.
  const [incidents, setIncidents] = useState<AgentIncident[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  // Representative OTel metric per service name (project cards); non-critical.
  const [metrics, setMetrics] = useState<Record<string, OtelServiceMetric>>({});
  // 서버 화면과 전체 로그는 Docker 서비스를 보여 주지 않으므로(ADR 0011) 같은 24시간 요약을 여기서 그린다.
  const [logData, setLogData] = useState<{ summaries: LogServiceSummary[]; patterns: LogPattern[] } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoadError(null);
    Promise.all([api.getLogSummary(), api.getLogPatterns({ agentId })])
      .then(([summaries, patterns]) => setLogData({ summaries: summaries ?? [], patterns: patterns ?? [] }))
      .catch(() => {});
    api.getAgentIncidents(agentId).then((d) => setIncidents(d ?? [])).catch(() => {});
    api.getAgentServiceMetrics(agentId)
      .then((rows) => setMetrics(Object.fromEntries((rows ?? []).map((m) => [m.serviceName, m]))))
      .catch(() => {});
    api.getAgentEvents(agentId, 8).then((d) => setEvents(d ?? [])).catch(() => {});
    try {
      const [agents, all] = await Promise.all([api.getAgents(), api.getAllAgentServicesFlat()]);
      setAgent(agents.find((a) => a.id === agentId) ?? null);
      setServices((all ?? []).filter((s) => s.agentId === agentId));
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);
  // 인프라 게이지는 자기 fetch를 가진다 — 새로고침마다 refreshKey로 함께 다시 읽힌다.
  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
    void load();
  }, [load]);
  useAutoRefresh(refresh, 30_000);

  const { spinning, trigger: handleRefresh } = useSpinAction(refresh);

  // 프로필이 없으면 전 기능 수집(MonitoringSetupPanel과 같은 기본값).
  const collects = (capability: AgentCollectionCapability) =>
    !agent?.profile?.capabilities.length || agent.profile.capabilities.includes(capability);

  const logOverview = useMemo(() => logData && agentId ? withLogSummaries(
    services.map((s) => ({
      key: logScopeKey({ agentId, serviceName: s.name }),
      name: s.name,
      subtitle: s.runtime ?? s.checkType,
      to: `/services/${agentId}/${encodeURIComponent(s.key)}?tab=logs&range=24h`,
    })),
    logData.summaries,
    logData.patterns,
  ) : null, [logData, services, agentId]);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || !agentId) return;
    try {
      await api.deleteAgent(agentId);
      toast.success('Docker 환경이 비활성화됐습니다');
      navigate('/environments');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-muted">
        <MaterialIcon size={24} name="sync" className="animate-spin" />
      </div>
    );
  }

  const agentName = agent?.name ?? services[0]?.agentName ?? agentId ?? '';
  const online = agent ? agentOnline(agent) : true;
  const healthy = services.filter((s) => s.healthy).length;
  const allHealthy = healthy === services.length;

  const activeIncidents = incidents.filter((i) => i.active);
  const banner = activeIncidents[0];

  // 수집하지 않는 기능의 탭은 두지 않는다. 서비스 목록은 이 화면의 주 내용이라 개요에 둔다.
  const tabs: TabItem<EnvTab>[] = [
    { key: 'overview', label: '개요' },
    ...(collects('infrastructure') ? [{ key: 'infrastructure' as const, label: '인프라' }] : []),
    ...(services.length > 0 && collects('logs') ? [{ key: 'logs' as const, label: '로그' }] : []),
    ...(services.length > 0 && collects('api') ? [{ key: 'api' as const, label: 'API 요청' }] : []),
  ];
  const basePath = `/agents/${agentId}`;
  const active = tabs.find((item) => item.key === tab)?.key;
  // 없는 탭이나 수집을 끈 기능의 주소는 개요로 보낸다(보기 쿼리는 유지).
  if (tab && !active) return <Navigate to={{ pathname: basePath, search: location.search }} replace />;
  const current: EnvTab = active ?? 'overview';
  // 화살표 키로 연달아 옮기면 기록을 덮어써서 뒤로 가기가 탭마다 멈추지 않는다.
  const open = (key: EnvTab, source?: 'keyboard') =>
    navigate({ pathname: key === 'overview' ? basePath : `${basePath}/${key}`, search: location.search }, { replace: source === 'keyboard' });

  return (
    <div className="space-y-8">
      {/* Back — mobile only; desktop navigates via the AppHeader breadcrumb (DESIGN.md §3.4) */}
      <Link
        to="/environments"
        className="lg:hidden flex items-center gap-1.5 text-sm text-text-muted hover:text-text-base transition-colors"
      >
        <MaterialIcon size={20} name="arrow_back" />
        Docker 환경 목록
      </Link>

      {loadError && (
        <section role="alert" className="flex flex-col gap-3 rounded-xl border border-ui-border-soft bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MaterialIcon name="sync_problem" className="mt-0.5 shrink-0 text-status-warn" />
            <p className="type-body text-text-secondary">Docker 환경 정보를 불러오지 못했습니다. {loadError}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      <PageHeader
        title={agentName}
        meta={
          <DetailMeta
            status={
              <>
                <CollectionStatusBadge status={online ? 'collecting' : 'delayed'} />
                <span>서비스 {services.length}개</span>
                <span>정상 {healthy}</span>
                {!allHealthy && <span>장애 {services.length - healthy}</span>}
              </>
            }
            fields={agent?.version ? [{ label: 'Version', value: `v${agent.version}` }] : []}
          />
        }
        actions={
          <>
            <RefreshIconButton onClick={handleRefresh} refreshing={spinning} />
            {agent && <>
              <Button collapseLabel variant="secondary" onClick={() => setShowInstall(true)}><MaterialIcon name="download" />Collector 설치</Button>
              <Button collapseLabel variant="secondary" onClick={() => setShowKey(true)}><MaterialIcon name="key" />API Key</Button>
              <Button collapseLabel variant="secondary" onClick={() => setShowInstrumentation(true)}><MaterialIcon name="integration_instructions" />상세 수집 설정</Button>
              <Button collapseLabel variant="destructive" onClick={() => setDeleteConfirm(true)}><MaterialIcon name="delete_outline" />비활성화</Button>
            </>}
          </>
        }
      />

      {/* 탭 → 패널 24px(group). 머리말 → 탭은 PageHeader의 아래 여백이다. */}
      <div className="page-stack">
        {/* Tabs는 포커스 링 자리로 -m-1을 가져 부모의 간격이 닿지 않는다. 한 겹 감싸 page-stack이 간격을 준다. */}
        <div className="min-w-0"><Tabs items={tabs} active={current} onChange={open} ariaLabel="Docker 환경 기능" idPrefix={ID_PREFIX} /></div>
      <div role="tabpanel" id={tabPanelId(ID_PREFIX, current)} aria-labelledby={tabId(ID_PREFIX, current)} className="space-y-8">
        {current === 'overview' && <>
          {/* 설정 가이드는 환경 전체의 일이라 개요에 둔다. 탭 위에 두면 모든 탭에서 탭 줄을 밀어냈다. */}
          {agent && (
            <MonitoringSetupPanel
              agent={agent}
              services={services}
              onInstall={() => setShowInstall(true)}
              onInstrument={() => setShowInstrumentation(true)}
              onAddCapability={setAddingCapability}
            />
          )}

          {/* Active incident banner */}
          {banner && (
            <Link
              to={`/services/${agentId}/${encodeURIComponent(banner.key)}`}
              className="w-full flex items-center gap-3 rounded-xl border border-ui-border-soft bg-bg-surface px-4 py-3 text-left hover:bg-ui-hover-soft transition-colors"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-status-error-fill animate-pulse shrink-0" />
              <span className="type-label text-text-base truncate">
                진행 중 장애: {banner.serviceName}
              </span>
              <span className="text-xs text-text-muted shrink-0">
                {formatDuration(banner.durationSec)} {'경과'}
                {activeIncidents.length > 1 && ` · +${activeIncidents.length - 1}`}
              </span>
            </Link>
          )}

          {/* Service health grid — 다른 섹션(인프라·로그)처럼 제목을 둔다. 보기 전환은 아래 로그 섹션에도 적용된다. */}
          <Section title="서비스" meta={`${services.length}개`} actions={<ListViewToggle view={view} onChange={setView} />}>
          {services.length === 0 && !loadError ? (
            <EmptyState icon="inventory_2" title="수집된 서비스가 없습니다" />
          ) : (
            view === 'grid' ? <ResourceTable rows={services} rowKey={row => row.key} ariaLabel="Docker 서비스 그리드" columns={[
              { key: 'state', label: '상태', className: 'w-24 sm:w-28', render: row => <DockerUptimeStatus service={row} /> },
              { key: 'name', label: '서비스', render: row => <><Link to={`/services/${agentId}/${encodeURIComponent(row.key)}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link><p className="mt-1 type-caption text-text-muted">{row.runtime || row.checkType}</p><p className="mt-2 truncate font-mono text-xs text-text-muted md:hidden">{row.endpoint}</p><p className="mt-1 type-caption text-text-muted md:hidden">응답 {row.lastLatency ?? '-'} · 상태 {row.lastStatus ?? '-'}</p></> },
              { key: 'endpoint', label: '체크 주소', className: 'hidden lg:table-cell', render: row => <Tooltip content={row.endpoint} focusable><p className="truncate font-mono text-xs text-text-muted">{row.endpoint}</p></Tooltip> },
              { key: 'latency', label: '응답 시간', className: 'hidden w-28 md:table-cell', align: 'right', render: row => row.lastLatency ?? '-' },
              { key: 'status', label: '상태 코드', className: 'hidden w-24 md:table-cell', align: 'right', render: row => row.lastStatus ?? '-' },
              { key: 'metric', label: '메트릭', className: 'hidden w-40 xl:table-cell', render: row => metrics[row.name] ? <div className="space-y-intra"><Tooltip content={metrics[row.name].metricName} focusable><p className="truncate font-mono text-xs text-text-muted">{metricLabel(metrics[row.name].metricName)}</p></Tooltip><p>{formatMetricValue(metrics[row.name].value, metrics[row.name].unit)}</p></div> : '-' },
            ]} /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {services.map((s) => (
                <ServiceCard
                  key={s.key}
                  service={s}
                  metric={metrics[s.name]}
                  to={`/services/${agentId}/${encodeURIComponent(s.key)}`}
                  returnTo={returnTo}
                />
              ))}
            </div>
          )}
          </Section>

          {/* 90-day uptime — 낮고 넓은 바라서 full-width 단독 행 (바 폭 확보 + 높이 불일치 해소) */}
          {services.length > 0 && agentId && (
            <AgentCheckHistoryBar agentId={agentId} />
          )}

          {/* Incident history | event timeline — 카드 없이 제목+간격으로 나눈 두 섹션(DESIGN.md §3.1) */}
          {services.length > 0 && agentId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Incident history */}
              <section>
                  <h3 className="mb-4 type-card-title text-text-base">장애 이력 · 30일</h3>
                  {incidents.length === 0 ? (
                    <p className="type-body text-text-muted py-4 text-center">최근 30일간 장애가 없습니다</p>
                  ) : (
                    <List>
                      {incidents.slice(0, 5).map((inc, i) => (
                        <ListRow
                          key={`${inc.key}-${inc.startedAt}-${i}`}
                          to={`/services/${agentId}/${encodeURIComponent(inc.key)}`}
                          marker={<span className={`h-1.5 w-1.5 rounded-full ${inc.active ? 'bg-status-error-fill' : 'bg-status-healthy-fill'}`} />}
                          title={inc.serviceName}
                          detail={`${formatIncidentTime(inc.startedAt)} 시작 · ${formatDuration(inc.durationSec)}`}
                          detailSize="caption"
                          trailing={<span className={inc.active ? 'text-status-error' : 'text-status-healthy'}>{inc.active ? '진행중' : '해소'}</span>}
                        />
                      ))}
                    </List>
                  )}
                </section>

                {/* Event timeline */}
                <section>
                  <h3 className="mb-4 type-card-title text-text-base">타임라인</h3>
                  {events.length === 0 ? (
                    <p className="type-body text-text-muted py-4 text-center">최근 이벤트가 없습니다</p>
                  ) : (
                    <div className="space-y-0.5">
                      {events.map((e) => (
                        <div key={e.id} className="flex items-baseline gap-2 py-1.5">
                          <span className="text-xs text-text-dim w-10 shrink-0">
                            {formatClock(e.time)}
                          </span>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 translate-y-px ${
                            e.type === 'alert_sent' ? 'bg-status-error-fill'
                            : e.type === 'status_change' ? 'bg-status-warn-fill'
                            : 'bg-status-idle-fill'
                          }`} />
                          <Tooltip content={e.message} focusable><span className="text-xs text-text-muted min-w-0 truncate">
                            {e.message || e.type}
                          </span></Tooltip>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
            </div>
          )}

        </>}

        {/* 서버의 인프라 탭은 직접 연결한 호스트만 보여 준다(ADR 0011). 이 Collector의 호스트 지표는 여기서 본다. */}
        {current === 'infrastructure' && agentId && <HostGauges hostId={agentId} refreshKey={refreshKey} />}

        {/* 서버 화면과 전체 로그는 Docker 서비스를 보여 주지 않으므로 같은 24시간 요약을 여기서 그린다. */}
        {current === 'logs' && (logOverview
          ? <LogServiceOverview rows={logOverview.rows} patterns={logOverview.patterns} span={logOverview.span} view={view} returnTo={returnTo} title="로그"
              viewToggle={<ListViewToggle view={view} onChange={setView} />} />
          : <EmptyState icon="sync" title="로그 요약을 불러오는 중입니다" headingLevel="h2" />)}

        {/* 모든 서비스의 요청을 합친 추이 */}
        {current === 'api' && agentId && (
          <AgentServiceRequestTrends agentId={agentId} refreshKey={refreshKey}
            empty={<EmptyState icon="show_chart" title="최근 요청이 없습니다" description="서비스가 요청을 받으면 여기에 추이가 나타납니다." headingLevel="h2" />} />
        )}
      </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Docker 환경 비활성화"
        message={`'${agent?.name ?? agentId}' Docker 환경을 비활성화하시겠습니까?`}
        description="Docker Collector 연결이 차단되며 수집 데이터는 보존됩니다."
        confirmLabel="비활성화"
      />

      {showKey && agent && (
        <ApiKeyModal agentId={agent.id} agentName={agent.name} onClose={() => setShowKey(false)} onRotated={load} />
      )}
      {showInstall && agent && (
        <AddServiceModal
          existingAgent={{ id: agent.id, name: agent.name }}
          onClose={() => setShowInstall(false)}
          onCreated={load}
          onOpenProject={() => setShowInstall(false)}
          onConfigureInstrumentation={() => {
            setShowInstall(false);
            setShowInstrumentation(true);
          }}
        />
      )}
      {addingCapability && agent && (
        <CollectorCapabilityDialog
          agent={agent}
          capability={addingCapability}
          onClose={() => setAddingCapability(null)}
          onApply={() => {
            setAddingCapability(null);
            setShowInstall(true);
            void load();
          }}
        />
      )}
      {showInstrumentation && agent && (
        <InstrumentationOverrideModal agentId={agent.id} onClose={() => setShowInstrumentation(false)} />
      )}
    </div>
  );
}
