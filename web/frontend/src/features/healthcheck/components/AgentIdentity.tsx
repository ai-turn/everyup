import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';
import { runtimeLabel } from '../runtimeLabels';

interface InfoChipProps {
  icon: string;
  label: string;
  value: string;
}

function InfoChip({ icon, label, value }: InfoChipProps) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-surface border border-ui-border">
      <MaterialIcon size={20} name={icon} className="text-text-muted" />
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-base">{value}</span>
    </div>
  );
}

// showName=false hides the service name + status badge — used where the surrounding
// layout (e.g. the project sidebar/rail) already shows them, to avoid duplication.
export function AgentIdentity({ service, showName = true }: { service: AgentServiceFlat; showName?: boolean }) {





  // red = 장애(unhealthy); offline(수집 중단)은 slate — 색/어휘 매핑 규칙 준수
  const status = service.healthy ? 'healthy' : 'unhealthy';
  const statusConfig = {
    healthy: {
      bg: 'bg-status-healthy/10',
      text: 'text-status-healthy', dot: 'bg-status-healthy', ping: 'bg-status-healthy',
      label: '정상',
    },
    unhealthy: {
      bg: 'bg-status-error/10',
      text: 'text-status-error', dot: 'bg-status-error', ping: 'bg-status-error',
      label: '장애',
    },
  };
  const cfg = statusConfig[status];

  const lastCheckedText = service.observedAt
    ? formatDistanceToNow(new Date(service.observedAt), { addSuffix: true, locale: ko })
    : '없음';

  return (
    <div className="mb-8">
      {showName && (
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-text-base">{service.name}</h1>
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${cfg.bg}`}>
            <span className="relative flex h-2 w-2">
              {service.healthy && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.ping} opacity-75`} />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
            </span>
            <span className={`${cfg.text} text-sm uppercase tracking-wider`}>
              {cfg.label}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <InfoChip icon="language" label="타입" value={service.checkType.toUpperCase()} />
        {service.runtime && <InfoChip icon="code" label="런타임" value={runtimeLabel(service.runtime)} />}
        {showName && <InfoChip icon="sensors" label="Docker 환경" value={service.agentName} />}
        {service.lastLatency && (
          <InfoChip icon="speed" label="지연시간" value={service.lastLatency} />
        )}
        <InfoChip icon="event" label="마지막 체크" value={lastCheckedText} />
      </div>

      {!service.healthy && service.lastError && (
        <div className="mt-4 p-3 rounded-lg bg-ui-hover-soft border border-ui-border text-sm text-text-secondary">
          <span className="text-status-error">오류: </span>
          {service.lastError}
        </div>
      )}
    </div>
  );
}
