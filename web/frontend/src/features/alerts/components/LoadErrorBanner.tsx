import { Button, MaterialIcon } from '../../../components/common';

/** 화면 일부의 조회 실패 — 그 자리의 중립 배너 + `다시 시도`(DESIGN §4.1). 빈 상태로 보이게 두지 않는다. */
export function LoadErrorBanner({ title, message, onRetry }: { title: string; message?: string | null; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ui-border bg-bg-surface px-4 py-3" role="alert">
      <MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-base">{title}</p>
        {message && <p className="mt-0.5 break-words type-body text-text-muted">{message}</p>}
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry}>다시 시도</Button>
    </div>
  );
}
