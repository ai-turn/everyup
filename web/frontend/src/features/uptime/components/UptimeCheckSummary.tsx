import { StatusLight, Tooltip } from '../../../components/common';
import type { TimelineIncident, UptimeMonitor, UptimeMonitorMetric } from '../../../services/api';
import { formatDuration, formatIncidentTime } from '../../../utils/incidentFormat';

interface Props {
  monitor: UptimeMonitor;
  metrics: UptimeMonitorMetric[] | null;
  incidents: TimelineIncident[] | null;
  metricsError?: string;
  incidentsError?: string;
  loading?: boolean;
}

export function UptimeCheckSummary({ monitor, metrics, incidents, metricsError, incidentsError, loading }: Props) {
  const latest = metrics?.reduce<UptimeMonitorMetric | undefined>((last, item) => !last || item.checkedAt > last.checkedAt ? item : last, undefined);
  const active = monitor.isActive && monitor.status === 'unhealthy' && !incidentsError
    ? incidents?.find((incident) => incident.active) : undefined;
  return (
    <div className="space-y-5">
      {!monitor.isActive && <p className="type-body text-text-muted">체크를 일시정지했습니다. 아래는 정지 전 기록입니다.</p>}
      {active && (
        <div>
          <StatusLight tone="error" label="장애 진행 중" />
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div><dt className="type-caption text-text-muted">장애 시작</dt><dd className="mt-0.5 text-sm tabular-nums"><Tooltip content={new Date(active.startedAt).toLocaleString()} focusable><span>{formatIncidentTime(active.startedAt)}</span></Tooltip></dd></div>
            <div><dt className="type-caption text-text-muted">지속 시간</dt><dd className="mt-0.5 text-sm tabular-nums">{formatDuration(active.durationSec)}</dd></div>
          </dl>
        </div>
      )}
      {incidentsError && <p role="status" className="type-caption text-text-muted">장애 시작 시각과 지속 시간을 확인할 수 없습니다. {incidentsError}</p>}
      <div>
        <h3 className="type-label text-text-base">최근 체크 결과</h3>
        {metricsError && <p role="status" className="mt-2 type-body text-text-muted">최근 체크를 갱신하지 못했습니다. {metricsError}{metrics?.length ? ' 아래는 이전에 불러온 기록입니다.' : ''}</p>}
        {latest ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusLight tone={latest.status === 'success' ? 'healthy' : 'error'} label={latest.status === 'success' ? '정상 응답' : '체크 실패'} />
              <Tooltip content={new Date(latest.checkedAt).toLocaleString()} focusable><span className="type-caption tabular-nums text-text-muted">{formatIncidentTime(latest.checkedAt)}</span></Tooltip>
            </div>
            <p className="break-all font-mono text-xs text-text-secondary">
              {latest.statusCode ? `HTTP ${latest.statusCode}` : monitor.type === 'tcp' ? 'TCP' : 'HTTP'}
              {latest.status === 'success' ? ` · ${latest.responseTime.toLocaleString()}ms` : latest.errorMessage ? ` · ${latest.errorMessage}` : ' · 체크 실패'}
            </p>
            {monitor.type === 'http' && <p className="type-caption text-text-muted">기대 상태 코드 {monitor.expectedStatus}</p>}
          </div>
        ) : <p className="mt-2 type-body text-text-muted">{loading ? '최근 체크를 불러오는 중' : metricsError ? '최근 체크 결과를 확인할 수 없습니다.' : monitor.isActive ? '아직 체크 기록이 없습니다. 첫 결과를 기다리는 중입니다.' : '저장된 체크 기록이 없습니다.'}</p>}
      </div>
    </div>
  );
}
