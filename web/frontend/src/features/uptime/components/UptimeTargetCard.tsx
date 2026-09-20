import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ResourceCardHeader } from '../../../components/common';

interface UptimeTargetCardProps {
  to: string;
  title: string;
  badge?: ReactNode;
  subtitle: string;
  status: ReactNode;
  endpoint: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function UptimeTargetCard({
  to, title, badge, subtitle, status, endpoint, meta, actions,
}: UptimeTargetCardProps) {
  return (
    // ponytail: stretched link — 카드 전체가 링크지만 상태 토글은 <a> 밖에 둔다
    <article className="card-interactive relative flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={
          <h3 className="truncate type-card-title text-text-base">
            <Link to={to} className="after:absolute after:inset-0 after:rounded-xl">{title}</Link>
          </h3>
        }
        badge={badge}
        subtitle={subtitle}
        status={status}
      />
      <p className="truncate font-mono text-xs text-text-dim">{endpoint}</p>
      {(meta || actions) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {meta}
          {actions && <div className="relative ml-auto">{actions}</div>}
        </div>
      )}
    </article>
  );
}
