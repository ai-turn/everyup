import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button, MaterialIcon } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';

interface ServiceIncidentBannerProps {
  service: AgentServiceFlat;
  /** Jump to the tab most useful for triaging the incident (logs). */
  onInvestigate: () => void;
}

// Prominent red banner shown at the top of a service's detail when it is down,
// so the cause, impact, and next action are visible without scrolling.
// Renders nothing for healthy services.
export function ServiceIncidentBanner({ service, onInvestigate }: ServiceIncidentBannerProps) {





  if (service.healthy) return null;

  const since = service.observedAt
    ? formatDistanceToNow(new Date(service.observedAt), { addSuffix: true, locale: ko })
    : null;

  return (
    <div className="flex items-center gap-3.5 mb-5 rounded-xl border border-ui-border bg-bg-surface px-4 py-3.5">
      <span className="h-2.5 w-2.5 rounded-full bg-status-error animate-pulse shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="type-label text-status-error">
          진행 중인 장애 — {service.name}
        </p>
        <p className="type-body text-text-muted mt-0.5">
          {service.lastError || '서비스가 응답하지 않습니다'}
          {since && <span className="text-text-dim"> · {'마지막 응답'} {since}</span>}
        </p>
      </div>
      <Button variant="danger" onClick={onInvestigate}>
        로그 확인
        <MaterialIcon size={20} name="arrow_forward" />
      </Button>
    </div>
  );
}
