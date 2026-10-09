import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import { api, type AgentEvent } from '../../../services/api';

interface AgentFailureHistoryProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

const ALERT_TYPES = new Set(['alert_sent', 'recovery_sent']);

export function AgentFailureHistory({ agentId, serviceKey, refreshKey }: AgentFailureHistoryProps) {


  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    api.getAgentServiceKeyEvents(agentId, serviceKey, 50)
      .then((data) => setEvents(data.filter((e) => ALERT_TYPES.has(e.type))))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, refreshKey]);

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-ui-border bg-bg-surface animate-pulse">
        <div className="h-5 bg-ui-active rounded w-40 mb-4" />
        {[1, 2].map((i) => (
          <div key={i} className="h-14 bg-ui-hover rounded-lg mb-3" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-ui-border bg-bg-surface">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-status-error/10 shrink-0">
          <MaterialIcon size={20} name="history" className="text-status-error" />
        </div>
        <div>
          <h2 className="type-section-title text-text-base tracking-tight">
            최근 장애 기록
          </h2>
          <p className="text-text-muted text-sm">
            Docker 서비스 알림 이벤트
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-status-healthy/10">
            <MaterialIcon size={24} name="check_circle" className="text-status-healthy" />
          </div>
          <p className="text-text-muted text-sm">장애 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const isAlert = event.type === 'alert_sent';
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-4 rounded-xl border border-ui-border bg-ui-hover-soft/50"
              >
                <MaterialIcon size={20}
                  name={isAlert ? 'error' : 'check_circle'}
                  className={`shrink-0 mt-0.5 ${isAlert ? 'text-status-error' : 'text-status-healthy'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-base truncate">
                    {event.message || (isAlert ? '장애 감지' : '복구 감지')}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {formatDistanceToNow(new Date(event.time), { addSuffix: true, locale: ko })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
