import { Fragment, type ReactNode } from 'react';
import { tableRowLinkHandlers } from '../../utils/tableRowLink';

export interface ResourceColumn<T> {
  key: string;
  label: ReactNode;
  className?: string;
  align?: 'right';
  render: (row: T) => ReactNode;
}

export function ResourceTable<T>({ rows, columns, rowKey, ariaLabel, renderDetails, alertRow }: {
  rows: T[];
  columns: ResourceColumn<T>[];
  rowKey: (row: T) => string | number;
  ariaLabel: string;
  renderDetails?: (row: T) => ReactNode;
  /** 진행 중인 장애 행. 옅은 상태색 채움으로 목록에서 먼저 보인다(좌측 세로선은 금지, DESIGN.md §9). */
  alertRow?: (row: T) => boolean;
}) {
  // 카드 셸·헤더 배경·행 구분선 없이 헤더 아래 옅은 선 하나만 둔다(DESIGN.md §3.1). 행은 hover 채움으로 드러난다.
  // table-bleed: 셀 패딩만큼 바깥으로 펼쳐 글자를 본문 정렬선에 맞춘다(§4.5).
  return <div className="table-bleed">
    <table aria-label={ariaLabel} className="w-full table-fixed text-sm">
      <thead className="border-b border-border text-xs text-text-muted"><tr>{columns.map((column) =>
        <th key={column.key} scope="col" className={`px-4 py-3 font-medium ${column.align ? 'text-right' : 'text-left'} ${column.className ?? ''}`}>{column.label}</th>,
      )}</tr></thead>
      <tbody>{rows.map((row) => {
        const details = renderDetails?.(row);
        return <Fragment key={rowKey(row)}><tr {...tableRowLinkHandlers} className={`table-row-link align-top transition-colors ${alertRow?.(row) ? 'bg-crit/6 hover:bg-crit/10' : 'hover:bg-surface-hover'}`}>{columns.map((column) =>
          <td key={column.key} className={`min-w-0 px-4 py-4 ${column.align ? 'text-right tabular-nums' : 'text-left'} ${column.className ?? ''}`}>{column.render(row)}</td>,
        )}</tr>{details && <tr><td colSpan={columns.length} className="p-4">{details}</td></tr>}</Fragment>;
      })}</tbody>
    </table>
  </div>;
}
