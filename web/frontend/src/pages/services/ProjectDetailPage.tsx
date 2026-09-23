import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { MaterialIcon } from '../../components/common/MaterialIcon';
import { Button, DetailActionToolbar, PageHeader } from '../../components/common';
import { CollectionStatusBadge } from '../../components/common/CollectionStatusBadge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useSpinAction } from '../../hooks/useSpinAction';
import {
  api,
  type AgentServiceFlat, type ConnectedAgent, type AgentIncident,
  type AgentEvent, type ServiceUptimeDay, type ApiRequestStatBucket,
  type OtelServiceMetric,
} from '../../services/api';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { MonitoringSetupPanel } from '../../features/services/components/MonitoringSetupPanel';
import { AgentServiceRequestTrends } from '../../features/healthcheck/components/AgentServiceRequestTrends';
import { AgentCheckHistoryBar } from '../../features/healthcheck/components/AgentCheckHistoryBar';
import { getErrorMessage } from '../../utils/errors';
import { activatable } from '../../utils/a11y';
import { formatDuration, formatIncidentTime } from '../../utils/incidentFormat';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}


// One KPI stat card for the project dashboard header row.
function KpiCard({ label, value, unit, sub, tone }: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: 'danger' | 'warn';
}) {
  const valueColor =
    tone === 'danger' ? 'text-status-error'
    : tone === 'warn' ? 'text-status-warn'
    : 'text-text-base';
  return (
    <div className="bg-bg-surface border border-ui-border rounded-xl p-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`text-xl mt-1 ${valueColor}`}>
        {value}
        {unit && <span className="text-xs text-text-dim ml-0.5">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-text-dim mt-0.5">{sub}</div>}
    </div>
  );
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
function ServiceCard({ service, metric, onOpen }: {
  service: AgentServiceFlat;
  metric?: OtelServiceMetric;
  onOpen: () => void;
}) {

  return (
    <div
      {...activatable(onOpen)}
      aria-label={service.name}
      className="card-interactive group bg-bg-surface border border-ui-border rounded-xl p-4 cursor-pointer flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <h3 className="type-card-title text-text-base truncate">{service.name}</h3>
            <span className="text-xs text-text-dim truncate block">{service.runtime ?? service.checkType}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge healthy={service.healthy} />
          <MaterialIcon size={20} name="chevron_right" className="text-text-dim group-hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="min-w-0">
          <div className="text-xs text-text-dim">응답시간</div>
          <div className="font-medium text-text-base truncate">{service.lastLatency ?? '—'}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-text-dim">상태</div>
          <div className={`${service.healthy ? 'text-status-healthy' : 'text-status-error'}`}>
            {service.lastStatus ?? '—'}
          </div>
        </div>
        {metric && (
          <div className="min-w-0">
            <div className="text-xs text-text-dim truncate" title={metric.metricName}>
              {metricLabel(metric.metricName)}
            </div>
            <div className="font-medium text-text-base truncate">
              {formatMetricValue(metric.value, metric.unit)}
            </div>
          </div>
        )}
      </div>

      {!service.healthy && service.lastError && (
        <p className="text-xs text-status-error truncate -mt-1">{service.lastError}</p>
      )}
    </div>
  );
}

// Project overview: aggregate header + service health grid. Individual service
// detail lives at /services/:agentId/:key (linked from the sidebar tree too).
export function ProjectDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();


  const [agent, setAgent] = useState<ConnectedAgent | null>(null);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showInstrumentation, setShowInstrumentation] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const headerName = agent?.name ?? services[0]?.agentName ?? '';
  useBreadcrumb(headerName ? [{ label: headerName }] : []);

  // Dashboard aggregates — non-critical, each fails independent of the main load.
  const [incidents, setIncidents] = useState<AgentIncident[]>([]);
  const [uptimeDays, setUptimeDays] = useState<ServiceUptimeDay[]>([]);
  const [reqBuckets, setReqBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  // Representative OTel metric per service name (project cards); non-critical.
  const [metrics, setMetrics] = useState<Record<string, OtelServiceMetric>>({});

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoadError(null);
    api.getAgentIncidents(agentId).then((d) => setIncidents(d ?? [])).catch(() => {});
    api.getAgentServiceMetrics(agentId)
      .then((rows) => setMetrics(Object.fromEntries((rows ?? []).map((m) => [m.serviceName, m]))))
      .catch(() => {});
    api.getAgentUptime(agentId, 30).then((d) => setUptimeDays(d ?? [])).catch(() => {});
    api.getAgentRequestStats(agentId, {
      from: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      bucketMins: 60,
    }).then((d) => setReqBuckets(d ?? [])).catch(() => {});
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
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const { spinning, trigger: handleRefresh } = useSpinAction(load);

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

  // Dashboard KPI derivations (ver2 redesign)
  const activeIncidents = incidents.filter((i) => i.active);
  const banner = activeIncidents[0];
  const uptimeTotals = uptimeDays.reduce(
    (acc, d) => ({ healthy: acc.healthy + d.healthyChecks, total: acc.total + d.totalChecks }),
    { healthy: 0, total: 0 },
  );
  const uptime30 = uptimeTotals.total > 0 ? (uptimeTotals.healthy / uptimeTotals.total) * 100 : null;
  const req24h = reqBuckets.reduce((s, b) => s + b.count, 0);
  const latestTimed = [...reqBuckets].reverse().find((b) => b.timed > 0);
  const p95 = latestTimed ? Math.round(latestTimed.p95) : null;

  return (
    <div className="space-y-5">
      {/* Back — mobile only; desktop navigates via the AppHeader breadcrumb (DESIGN.md §3.4) */}
      <button
        onClick={() => navigate('/environments')}
        className="lg:hidden flex items-center gap-1 text-sm text-text-muted hover:text-text-base transition-colors"
      >
        <MaterialIcon size={20} name="arrow_back" />
        Docker 환경 목록
      </button>

      {loadError && (
        <section role="alert" className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 type-caption">
            <CollectionStatusBadge status={online ? 'collecting' : 'delayed'} />
            <span className="text-text-secondary">
              서비스 {services.length}개 · 정상 {healthy}
              {!allHealthy && ` · 장애 ${services.length - healthy}`}
            </span>
            {agent?.version && <span className="text-text-dim">v{agent.version}</span>}
          </div>
        }
      />
      <DetailActionToolbar
        controls={
          <Button variant="secondary" onClick={handleRefresh}>
            <MaterialIcon name="refresh" className={spinning ? 'animate-spin' : ''} />새로고침
          </Button>
        }
        actions={agent && (
          <>
            <Button variant="secondary" onClick={() => setShowInstall(true)}><MaterialIcon name="download" />수집기 설치</Button>
            <Button variant="secondary" onClick={() => setShowKey(true)}><MaterialIcon name="key" />API 키</Button>
            <Button variant="secondary" onClick={() => setShowInstrumentation(true)}><MaterialIcon name="integration_instructions" />계측 설정</Button>
            <Button variant="destructive" onClick={() => setDeleteConfirm(true)}><MaterialIcon name="delete_outline" />비활성화</Button>
          </>
        )}
      />

      {agent && (
        <MonitoringSetupPanel
          agent={agent}
          services={services}
          onInstall={() => setShowInstall(true)}
          onInstrument={() => setShowInstrumentation(true)}
        />
      )}

      {/* Active incident banner */}
      {banner && (
        <button
          onClick={() => navigate(`/services/${agentId}/${encodeURIComponent(banner.key)}`)}
          className="w-full flex items-center gap-3 rounded-xl border border-ui-border bg-bg-surface px-4 py-3 text-left hover:bg-ui-hover-soft transition-colors"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-status-error animate-pulse shrink-0" />
          <span className="text-sm font-medium text-text-base truncate">
            진행 중 장애 — {banner.serviceName}
          </span>
          <span className="text-xs text-text-muted shrink-0">
            {formatDuration(banner.durationSec)} {'경과'}
            {activeIncidents.length > 1 && ` · +${activeIncidents.length - 1}`}
          </span>
          <span className="ml-auto text-xs font-medium text-primary shrink-0 flex items-center">
            서비스 열기
            <MaterialIcon size={20} name="chevron_right" />
          </span>
        </button>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="가동률 · 30일"
          value={uptime30 !== null ? uptime30.toFixed(2) : '—'}
          unit={uptime30 !== null ? '%' : undefined}
        />
        <KpiCard
          label="활성 장애"
          value={String(activeIncidents.length)}
          tone={activeIncidents.length > 0 ? 'danger' : undefined}
          sub={activeIncidents.length > 0 ? activeIncidents.map((i) => i.serviceName).join(', ') : undefined}
        />
        <KpiCard
          label="요청 · 24시간"
          value={req24h > 0 ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(req24h) : '—'}
        />
        <KpiCard
          label="p95 · 최근"
          value={p95 !== null ? String(p95) : '—'}
          unit={p95 !== null ? 'ms' : undefined}
          tone={p95 !== null && p95 > 500 ? 'warn' : undefined}
        />
      </div>

      {/* Service health grid */}
      {services.length === 0 && !loadError ? (
        <div className="py-16 text-center">
          <MaterialIcon size={36} name="inventory_2" className="text-text-dim mb-2" />
          <p className="text-sm text-text-dim">수집된 서비스가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <ServiceCard
              key={s.key}
              service={s}
              metric={metrics[s.name]}
              onOpen={() => navigate(`/services/${agentId}/${encodeURIComponent(s.key)}`)}
            />
          ))}
        </div>
      )}

      {/* Project-level Requests aggregate (rolls up all services; self-hides when no request data) */}
      {services.length > 0 && agentId && (
        <AgentServiceRequestTrends agentId={agentId} />
      )}

      {/* 90-day uptime — 낮고 넓은 바라서 full-width 단독 행 (바 폭 확보 + 높이 불일치 해소) */}
      {services.length > 0 && agentId && (
        <AgentCheckHistoryBar agentId={agentId} />
      )}

      {/* Incident history | event timeline — 둘 다 리스트 카드라 나란히 두면 높이가 맞는다 */}
      {services.length > 0 && agentId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* Incident history */}
          <div className="bg-bg-surface border border-ui-border rounded-xl p-4">
              <h3 className="type-card-title text-text-base mb-3">장애 이력 · 30일</h3>
              {incidents.length === 0 ? (
                <p className="type-body text-text-muted py-4 text-center">최근 30일간 장애가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {incidents.slice(0, 5).map((inc, i) => (
                    <button
                      type="button"
                      key={`${inc.key}-${inc.startedAt}-${i}`}
                      onClick={() => navigate(`/services/${agentId}/${encodeURIComponent(inc.key)}`)}
                      className="w-full flex items-start gap-2.5 rounded-lg border border-ui-border px-3 py-2 text-left transition-colors hover:border-slate-300 dark:hover:border-ui-active-dark"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${inc.active ? 'bg-status-error' : 'bg-status-healthy'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-text-base truncate">{inc.serviceName}</span>
                        <span className="block text-xs text-text-dim mt-0.5">
                          {formatIncidentTime(inc.startedAt)} {'시작'} · {formatDuration(inc.durationSec)}
                        </span>
                      </span>
                      <span className={`text-xs shrink-0 ${inc.active ? 'text-status-error' : 'text-status-healthy'}`}>
                        {inc.active ? '진행중' : '해소'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Event timeline */}
            <div className="bg-bg-surface border border-ui-border rounded-xl p-4">
              <h3 className="type-card-title text-text-base mb-3">타임라인</h3>
              {events.length === 0 ? (
                <p className="type-body text-text-muted py-4 text-center">최근 이벤트가 없습니다</p>
              ) : (
                <div className="space-y-0.5">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-baseline gap-2.5 py-1.5 border-b border-ui-border-soft/50 last:border-0">
                      <span className="text-xs text-text-dim w-10 shrink-0">
                        {new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 translate-y-px ${
                        e.type === 'alert_sent' ? 'bg-red-500'
                        : e.type === 'status_change' ? 'bg-amber-500'
                        : 'bg-slate-300 dark:bg-ui-active-dark'
                      }`} />
                      <span className="text-xs text-text-muted min-w-0 truncate" title={e.message}>
                        {e.message || e.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Docker 환경 비활성화"
        message={`'${agent?.name ?? agentId}' Docker 환경을 비활성화하시겠습니까?`}
        description="Docker 수집기 연결이 차단되며 수집 데이터는 보존됩니다."
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
      {showInstrumentation && agent && (
        <InstrumentationOverrideModal agentId={agent.id} onClose={() => setShowInstrumentation(false)} />
      )}
    </div>
  );
}
