import type { ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ControlDefaultsContext } from './controlSize';

// 상세 화면 PageHeader의 `meta` 정본 (DESIGN.md §4.1 상세 헤더).
// 상태 줄(상태 + 상태를 바꾸는 액션 + 수시로 바뀌는 값)과 속성 목록(라벨 좌 / 값 우, 2열)을
// 나눈다. 모든 항목을 한 줄에 흘리던 이전 형태는 라벨·값·버튼이 같은 12px로 이어져
// 한 문장처럼 읽혔고, 라벨 위/값 아래 그리드는 시선이 칸마다 위아래로 오르내렸다.
export interface DetailMetaField {
  label: string;
  /** 값과, 그 값을 바꾸는 액션(ghost 버튼·Select)을 함께 둔다 */
  value: ReactNode;
}

interface DetailMetaProps {
  status: ReactNode;
  /** 대상의 연결 방식 한 줄(대상 상세, DESIGN.md §4.7). 상태 줄 바로 아래, 접히는 속성 위라 좁은 화면에서도 늘 보인다. */
  connection?: ReactNode;
  fields?: DetailMetaField[];
  collapseOnMobile?: boolean;
  /** 접힌 속성 목록의 이름 — 대상이 서비스가 아니면(인프라 서버 등) 바꾼다 */
  collapseLabel?: string;
  /** 모든 폭에서 접는다(서버 탭의 패널). 요약 줄에 속성 이름을 함께 적어 펼치지 않고도 무엇이 있는지 보인다. */
  collapsed?: boolean;
}

const TOUCH_CONTROLS = {};
const COMPACT_CONTROLS = { size: 'sm' } as const;

export function DetailMeta({ status, connection, fields = [], collapseOnMobile = false, collapseLabel = '서비스 정보', collapsed = false }: DetailMetaProps) {
  const narrow = useMediaQuery('(max-width: 639px)');
  const fieldList = fields.length > 0 ? (
    // 행 높이는 하나다: sm 이상 40px(값 안의 조작은 sm 32px), 터치 화면 44px(조작 md 44px). 이전에는 조작이 든 행만
    // 버튼 40 + py-1로 44~48px가 되어 행 간격이 40/44로 섞였다(DESIGN.md §4.1 DetailMeta).
    <ControlDefaultsContext.Provider value={narrow ? TOUCH_CONTROLS : COMPACT_CONTROLS}>
    <dl className="grid max-w-4xl sm:grid-cols-2 sm:gap-x-12">
      {fields.map(field => (
        <div key={field.label} className="flex min-h-11 min-w-0 items-center gap-4 sm:min-h-10">
          <dt className="w-24 shrink-0 type-body text-text-dim">{field.label}</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-2 type-body text-text-base">{field.value}</dd>
        </div>
      ))}
    </dl>
    </ControlDefaultsContext.Provider>
  ) : null;
  return (
    <div className="space-y-label">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 type-caption text-text-muted">{status}</div>
      {connection}
      {fieldList && (collapsed || (collapseOnMobile && narrow) ? (
        <details>
          <summary className={`min-h-11 cursor-pointer content-center type-body text-action ${collapsed ? 'sm:min-h-8' : ''}`}>
            {collapseLabel}
            {collapsed && <span className="ml-2 type-caption text-text-muted">{fields.map(field => field.label).join(', ')}</span>}
          </summary>
          {fieldList}
        </details>
      ) : fieldList)}
    </div>
  );
}
