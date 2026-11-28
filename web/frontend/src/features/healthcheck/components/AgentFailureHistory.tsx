import { useEffect, useState } from 'react';
import { Section } from '../../../components/common';
import { api, type AgentEvent } from '../../../services/api';
import { formatClock, formatIncidentTime } from '../../../utils/incidentFormat';
import { UptimeFetchNotice } from './UptimeFetchNotice';

interface AgentFailureHistoryProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

const EVENT_LABEL: Record<string, string> = {
  alert_sent: '알림 발송', recovery_sent: '복구 알림', status_change: '상태 변경', deploy: '배포',
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/**
 * 컨테이너의 이벤트 타임라인(G안 `장애 타임라인`): 상태 변경, 배포, 알림 발송을 새것부터. 한 줄이 시각 · 이름 · 메시지다.
 * 알림 발송만 보이던 `최근 알림 기록`을 대신한다 — 장애가 언제 시작되고 무엇이 뒤따랐는지가 한 곳에 있다.
 */
export function AgentFailureHistory({ agentId, serviceKey, refreshKey }: AgentFailureHistoryProps) {
  const [events, setEvents] = useState<AgentEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api.getAgentServiceKeyEvents(agentId, serviceKey, 20)
      .then((data) => { if (active) { setEvents(data); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [agentId, serviceKey, refreshKey, attempt]);

  const shown = (events ?? []).slice(0, 8);
  return (
    <Section label="이벤트" title="이벤트" meta={events ? `최근 ${events.length}건` : undefined}>
      {error && <UptimeFetchNotice source="이벤트" onRetry={() => setAttempt((value) => value + 1)} />}
      {events === null && !error ? <div className="h-32 animate-pulse rounded-md bg-surface-hover" />
        : shown.length === 0 && !error ? <p className="py-3 type-body text-text-muted">이벤트 없음</p> : (
          <ol className="border-t border-border">
            {shown.map((event) => {
              const alert = event.type === 'alert_sent';
              return (
                <li key={event.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-border px-3 cell">
                  <span className="tabular-nums type-caption text-text-faint">{isToday(event.time) ? formatClock(event.time, true) : formatIncidentTime(event.time)}</span>
                  <span className="min-w-0">
                    <span className={`block type-label ${alert ? 'text-crit-text' : 'text-text'}`}>{EVENT_LABEL[event.type] ?? event.type}</span>
                    {event.message && <span className="block truncate type-caption text-text-faint">{event.message}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
    </Section>
  );
}
