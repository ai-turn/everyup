import { Button } from '../../../components/common';

export function UptimeFetchNotice({ source, onRetry }: { source: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ui-border bg-bg-surface px-4 py-3 text-sm text-text-secondary">
      <p>{source} 조회에 실패했습니다. 이전 데이터가 있으면 유지합니다.</p>
      <Button size="sm" variant="secondary" onClick={onRetry}>다시 시도</Button>
    </div>
  );
}
