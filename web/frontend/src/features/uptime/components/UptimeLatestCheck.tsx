import { Tooltip } from '../../../components/common';
import type { TimelineIncident, UptimeMonitor, UptimeMonitorMetric } from '../../../services/api';
import { formatDuration, formatIncidentTime } from '../../../utils/incidentFormat';

interface Props {
  monitor: UptimeMonitor;
  metrics: UptimeMonitorMetric[] | null;
  incidents: TimelineIncident[] | null;
  incidentsError?: string;
}

/**
 * 상세 헤더 상태 줄(DetailMeta status)에 놓는 진행 중 장애와 최근 체크 결과.
 * 예전에는 "현재 상태" 카드가 따로 있었는데, 제목 둘(현재 상태·최근 체크 결과)에 헤더의 상태와
 * "마지막 확인"을 다시 말하고 있었다(2026-11-14). 조회 실패는 페이지의 실패 배너가 말한다.
 */
export function UptimeLatestCheck({ monitor, metrics, incidents, incidentsError }: Props) {
  const latest = metrics?.reduce<UptimeMonitorMetric | undefined>((last, item) => !last || item.checkedAt > last.checkedAt ? item : last, undefined);
  const active = monitor.isActive && monitor.status === 'unhealthy' && !incidentsError
    ? incidents?.find((incident) => incident.active) : undefined;
  const result = latest && [
    latest.statusCode ? `HTTP ${latest.statusCode}` : monitor.type === 'tcp' ? 'TCP' : 'HTTP',
    // 실패한 체크의 대기 시간은 응답 시간이 아니다 — 원인을 보인다.
    latest.status === 'success' ? `${latest.responseTime.toLocaleString()}ms` : latest.errorMessage || '체크 실패',
  ].join(', ');
  return (
    <>
      {active && (
        <Tooltip content={`${formatIncidentTime(active.startedAt)} 시작`} focusable>
          <span className="tabular-nums text-status-error">장애 {formatDuration(active.durationSec)}째</span>
        </Tooltip>
      )}
      {latest && (
        <span role="group" aria-label="최근 체크" className="break-all">
          최근 체크 {result}{' '}
          <Tooltip content={new Date(latest.checkedAt).toLocaleString()} focusable>
            <span className="tabular-nums text-text-muted">({formatIncidentTime(latest.checkedAt)})</span>
          </Tooltip>
        </span>
      )}
    </>
  );
}
