import type { ReactNode } from 'react';
import { EmptyState } from '../../../components/common';

/** 연결된 대상이 없는 기능 탭의 안내. children 자리에 연결을 시작하는 버튼을 둔다. */
export function ConnectPrompt({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  // 서버 상세의 h1 바로 아래 탭 패널이므로 제목은 h2다.
  return <EmptyState icon="add_circle" title={title} description={description} headingLevel="h2">{children}</EmptyState>;
}
