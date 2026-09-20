import type { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface ResourceCardHeaderProps {
  icon: string;
  title: ReactNode;
  badge?: ReactNode;
  subtitle?: string;
  status?: ReactNode;
}

export function ResourceCardHeader({ icon, title, badge, subtitle, status }: ResourceCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <MaterialIcon name={icon} size={20} className="mt-0.5 shrink-0 text-text-muted" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0">{title}</div>
            {badge}
          </div>
          {subtitle && <p className="mt-1 truncate type-caption text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {status && <div className="relative shrink-0">{status}</div>}
    </div>
  );
}
