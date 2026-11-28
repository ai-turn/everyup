import { Fragment, type ReactNode } from 'react';
import { tableRowLinkHandlers } from '../../utils/tableRowLink';

export interface ResourceColumn<T> {
  key: string;
  label: ReactNode;
  className?: string;
  align?: 'right';
  render: (row: T) => ReactNode;
}

export function ResourceTable<T>({ rows, columns, rowKey, ariaLabel, renderDetails }: {
  rows: T[];
  columns: ResourceColumn<T>[];
  rowKey: (row: T) => string | number;
  ariaLabel: string;
  renderDetails?: (row: T) => ReactNode;
}) {
  // G안 목록: 카드 셸·헤더 배경 없이 흐린 12px 열 이름, 행마다 위 헤어라인, 맨 아래 선 하나(DESIGN.md §3.1). 행은 hover 채움으로 드러난다.
  // 장애 행을 채우지 않는다 — 상태는 행 앞의 모양과 상태 단어가 말한다.
  // table-bleed: 셀 패딩만큼 바깥으로 펼쳐 글자를 본문 정렬선에 맞춘다(§4.5).
  return <div className="table-bleed">
    <table aria-label={ariaLabel} className="w-full table-fixed border-b border-border text-sm">
      <thead className="type-label-sm text-text-faint"><tr>{columns.map((column) =>
        <th key={column.key} scope="col" className={`px-4 pt-2.5 pb-2 font-medium ${column.align ? 'text-right' : 'text-left'} ${column.className ?? ''}`}>{column.label}</th>,
      )}</tr></thead>
      <tbody>{rows.map((row) => {
        const details = renderDetails?.(row);
        return <Fragment key={rowKey(row)}><tr {...tableRowLinkHandlers} className="table-row-link border-t border-border align-middle transition-colors hover:bg-surface-hover">{columns.map((column) =>
          <td key={column.key} className={`min-w-0 px-4 py-2 ${column.align ? 'text-right tabular-nums' : 'text-left'} ${column.className ?? ''}`}>{column.render(row)}</td>,
        )}</tr>{details && <tr><td colSpan={columns.length} className="p-4">{details}</td></tr>}</Fragment>;
      })}</tbody>
    </table>
  </div>;
}
