import type { ReactNode } from 'react';
import { ButtonLink, MaterialIcon, OverflowMenu, type OverflowMenuItem } from '../../../components/common';
import type { ObservedService } from '../../../services/api';
import { alertRulesPath } from '../../alerts/alertTarget';

/**
 * 서버 탭의 앱 패널(로그, API 요청, 메트릭) 제목 줄. 앱 이름(type-page-title, §4.7 대상 상세의 위계)과 주 조작 하나(알림 규칙),
 * 더보기(옮기기, 삭제·연결 해제)다(DESIGN.md §4.1 상세 헤더). children은 그 아래의 상태 줄(DirectConnectionMeta)이고, 제목이 상태
 * 줄에 붙어 보이게 제목 → 상태 8px(label)을 이 머리말이 갖는다(§3.7 부모가 간격을 정한다).
 */
export function DirectPanelTitle({ service, menuItems, children }: { service: ObservedService; menuItems: OverflowMenuItem[]; children: ReactNode }) {
  return (
    <div className="space-y-label">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 wrap-anywhere text-text-base type-page-title">{service.name}</h2>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: service.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          <OverflowMenu items={menuItems} />
        </div>
      </div>
      {children}
    </div>
  );
}
