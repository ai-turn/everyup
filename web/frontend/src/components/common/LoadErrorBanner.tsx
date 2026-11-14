import type { ReactNode } from 'react';
import { Button } from './Button';
import { MaterialIcon } from './MaterialIcon';

/**
 * 화면 일부의 조회 실패 — 경고 아이콘 + 중립 글자 + `다시 시도`(DESIGN §4.1).
 * 문장을 경고색으로 칠하지 않는다: 색은 아이콘 하나에만 싣는다(§5.3).
 *
 * `inline`: 표 칸·카드·차트 카드 안처럼 상자를 하나 더 두면 카드 속 카드가 되는 자리.
 * `children`: `다시 시도` 대신 놓을 조작(기간 선택 등).
 */
export function LoadErrorBanner({ title, message, onRetry, retryLabel = '다시 시도', retrying = false, inline = false, role = 'alert', children }: {
  title: string;
  message?: ReactNode;
  onRetry?: () => void;
  /** 같은 화면에 다시 시도가 여럿이면 무엇을 다시 하는지 밝힌다(`목록 다시 시도`). */
  retryLabel?: string;
  retrying?: boolean;
  inline?: boolean;
  role?: 'alert' | 'status';
  children?: ReactNode;
}) {
  const retry = onRetry && <Button size="sm" variant="secondary" loading={retrying} onClick={onRetry}>{retryLabel}</Button>;
  if (inline) {
    return (
      <div role={role} className="space-y-2">
        <p className="flex items-start gap-1.5 type-label text-text-base">
          <MaterialIcon size={20} name="sync_problem" className="shrink-0 text-status-warn" />{title}
        </p>
        {message && <p className="break-words type-body text-text-muted">{message}</p>}
        {retry}{children}
      </div>
    );
  }
  return (
    <div role={role} className="flex items-start gap-3 rounded-xl border border-ui-border bg-bg-surface px-4 py-3">
      <MaterialIcon size={20} name="sync_problem" className="mt-0.5 shrink-0 text-status-warn" />
      <div className="min-w-0 flex-1">
        <p className="type-label text-text-base">{title}</p>
        {message && <p className="mt-0.5 break-words type-body text-text-muted">{message}</p>}
        {children}
      </div>
      {retry}
    </div>
  );
}
