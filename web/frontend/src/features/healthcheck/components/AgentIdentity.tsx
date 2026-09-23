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

// 서비스 이름·상태는 페이지 헤더(PageHeader)가 보여준다 — 여기서는 속성 칩만.
export function AgentIdentity({ service }: { service: AgentServiceFlat }) {
  const lastCheckedText = service.observedAt
    ? formatDistanceToNow(new Date(service.observedAt), { addSuffix: true, locale: ko })
    : '없음';

  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-2">
        <InfoChip icon="language" label="타입" value={service.checkType.toUpperCase()} />
        {service.runtime && <InfoChip icon="code" label="런타임" value={runtimeLabel(service.runtime)} />}
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
