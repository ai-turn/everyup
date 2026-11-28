import { useEffect, useState } from 'react';
import { Section } from '../../../components/common';
import { api, type AgentIncident, type AgentServiceFlat, type LogEntry } from '../../../services/api';
import { formatClock, formatDuration, formatIncidentTime } from '../../../utils/incidentFormat';
import { LEVEL_TEXT } from '../logLevelStyle';

/**
 * 장애 수치 상자(G안, Better Stack): 컨테이너가 응답하지 않는 동안만 개요 맨 위에 둔다.
 * 응답 없음 지속 · 마지막 정상 응답(장애 시작 시각) · 재시작 · 7일 장애 수.
 */
export function IncidentFigures({ service, refreshKey }: { service: AgentServiceFlat; refreshKey: number }) {
  const [incidents, setIncidents] = useState<AgentIncident[] | null>(null);
  useEffect(() => {
    let alive = true;
    api.getAgentIncidents(service.agentId, 7, 50)
      .then((rows) => { if (alive) setIncidents((rows ?? []).filter((incident) => incident.key === service.key)); })
      .catch(() => { if (alive) setIncidents(null); });
    return () => { alive = false; };
  }, [service.agentId, service.key, refreshKey]);
  if (service.healthy || !service.seen) return null;
  const active = incidents?.find((incident) => incident.active);
  const resolved = (incidents ?? []).filter((incident) => !incident.active).length;
  const box = (label: string, value: string, note?: string, crit = false) => (
    <div className="rounded-lg border border-border bg-surface px-4.5 py-4">
      <p className="type-body text-text-muted">{label}</p>
      <p className="mt-label flex items-baseline gap-1.5">
        <span className={`type-kpi ${crit ? 'text-crit-text' : 'text-text'}`}>{value}</span>
        {note && <span className="type-caption text-text-faint">{note}</span>}
      </p>
    </div>
  );
  return (
    <section aria-label="장애 현황" className="grid grid-cols-2 gap-tile lg:grid-cols-4">
      {box('응답 없음 지속', active ? formatDuration(active.durationSec) : '-', undefined, true)}
      {box('마지막 정상 응답', active ? formatClock(active.startedAt, true) : '-')}
      {box('재시작', String(service.restartCount ?? 0), '회')}
      {box('장애 · 7일', incidents ? String(incidents.length) : '-', incidents ? `건 · 해결 ${resolved}` : undefined)}
    </section>
  );
}

/** 최근 로그(G안): 이 컨테이너의 마지막 로그 여덟 줄, mono 한 줄(시각 · 레벨 · 메시지). */
export function RecentContainerLogs({ agentId, serviceKey, refreshKey, onOpenLogs }: { agentId: string; serviceKey: string; refreshKey: number; onOpenLogs: () => void }) {
  const [logs, setLogs] = useState<LogEntry[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.getAgentServiceLogs(agentId, serviceKey, { limit: 8 })
      .then((page) => { if (alive) setLogs(page?.data ?? []); })
      .catch(() => { if (alive) setLogs(null); });
    return () => { alive = false; };
  }, [agentId, serviceKey, refreshKey]);
  return (
    <Section label="최근 로그" title="최근 로그"
      actions={<button type="button" onClick={onOpenLogs} className="inline-flex min-h-11 cursor-pointer items-center type-caption text-text-muted link-underline sm:min-h-0">전체 로그</button>}>
      {logs === undefined ? <div className="h-32 animate-pulse rounded-md bg-surface-hover" />
        : logs === null ? <p className="py-3 type-body text-text-muted">로그를 불러오지 못했습니다</p>
          : logs.length === 0 ? <p className="py-3 type-body text-text-muted">로그 없음</p> : (
            <ol className="border-t border-border font-mono type-caption">
              {logs.map((log) => (
                <li key={log.id} className="grid grid-cols-[4rem_3rem_minmax(0,1fr)] gap-3 border-b border-border px-3 cell">
                  <span className="tabular-nums text-text-faint">{new Date(log.createdAt).toDateString() === new Date().toDateString() ? formatClock(log.createdAt, true) : formatIncidentTime(log.createdAt)}</span>
                  <span className={LEVEL_TEXT[log.level] ?? 'text-text-muted'}>{log.level}</span>
                  <span className="truncate text-text">{log.message}</span>
                </li>
              ))}
            </ol>
          )}
    </Section>
  );
}
