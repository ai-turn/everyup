import type { ReactNode } from 'react';

interface DetailActionToolbarProps {
  controls: ReactNode;
  actions: ReactNode;
}

// 상세 화면의 조회 제어와 변경 액션을 분리한다 — 조회 제어는 왼쪽, 변경 액션은 오른쪽 끝.
// 좁은 화면에서는 호출부가 버튼에 collapseLabel을 걸어 아이콘만 남기므로 보통 한 줄에 들어가고,
// 그래도 넘치면 줄이 바뀌어도 액션 그룹은 오른쪽에 붙는다(ml-auto).
export function DetailActionToolbar({ controls, actions }: DetailActionToolbarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {controls}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {actions}
      </div>
    </div>
  );
}
