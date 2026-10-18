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
  return <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
    <table aria-label={ariaLabel} className="w-full table-fixed text-sm">
      <thead className="border-b border-ui-border bg-ui-table-header text-xs text-text-muted"><tr>{columns.map((column) =>
        <th key={column.key} scope="col" className={`px-3 py-3 font-medium sm:px-4 ${column.align ? 'text-right' : 'text-left'} ${column.className ?? ''}`}>{column.label}</th>,
      )}</tr></thead>
      <tbody className="divide-y divide-ui-border-soft">{rows.map((row) => {
        const details = renderDetails?.(row);
        return <Fragment key={rowKey(row)}><tr {...tableRowLinkHandlers} className="table-row-link align-top transition-colors hover:bg-ui-hover-soft">{columns.map((column) =>
          <td key={column.key} className={`min-w-0 px-3 py-4 sm:px-4 ${column.align ? 'text-right tabular-nums' : 'text-left'} ${column.className ?? ''}`}>{column.render(row)}</td>,
        )}</tr>{details && <tr><td colSpan={columns.length} className="p-3 sm:p-4">{details}</td></tr>}</Fragment>;
      })}</tbody>
    </table>
  </div>;
}
