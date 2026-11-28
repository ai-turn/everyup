import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EmptyState } from '../../../components/common';

/** 연결된 대상이 없는 기능 탭의 안내. children 자리에 연결을 시작하는 버튼을 둔다. */
export function ConnectPrompt({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  // 서버 상세의 h1 바로 아래 탭 패널이므로 제목은 h2다.
  return <EmptyState icon="add_circle" title={title} description={description} headingLevel="h2">{children}</EmptyState>;
}

/** 탭 줄 오른쪽의 조작 자리(ServerDetailPage)에 그린다. 자리가 아직 없으면 그리지 않는다. */
export function TabAction({ slot, children }: { slot?: HTMLElement | null; children: ReactNode }) {
  return slot ? createPortal(children, slot) : null;
}

/** 탭 본문의 자리 표시. 다른 화면으로 옮겨 가는 중이다. */
export function PanelPlaceholder() {
  return (
    <div role="status" className="h-96 animate-pulse rounded-xl bg-surface-hover">
      <span className="sr-only">로딩 중…</span>
    </div>
  );
}
