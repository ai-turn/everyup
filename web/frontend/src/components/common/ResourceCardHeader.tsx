import type { ReactNode } from 'react';

interface ResourceCardHeaderProps {
  title: ReactNode;
  badge?: ReactNode;
  subtitle?: string;
  status?: ReactNode;
}

// 대상 아이콘은 뺐다 — 한 목록의 카드가 전부 같은 아이콘을 달고 있어서(업타임=monitor_heart,
// API=api, …) 카드끼리 구분되는 정보가 0이었다. 종류는 페이지 제목과 사이드바가 이미 말한다.
// 아이콘이 사라지면서 카드 안의 좌측 기준선도 자연히 하나가 된다.
export function ResourceCardHeader({ title, badge, subtitle, status }: ResourceCardHeaderProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">{title}</div>
          {badge}
        </div>
        {status && <div className="relative shrink-0">{status}</div>}
      </div>
      {subtitle && <p className="mt-1 truncate type-caption text-text-muted">{subtitle}</p>}
    </div>
  );
}
