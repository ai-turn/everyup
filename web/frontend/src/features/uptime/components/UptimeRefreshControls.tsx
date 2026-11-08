import { Button, MaterialIcon, Toggle, Tooltip } from '../../../components/common';

interface Props {
  updatedAt: Date | null;
  refreshing: boolean;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export function UptimeRefreshControls({ updatedAt, refreshing, autoRefresh, onAutoRefreshChange, onRefresh, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="업타임 갱신">
      <p className="type-caption text-text-muted" aria-live="polite">
        {refreshing ? '갱신 중' : updatedAt ? (
          <Tooltip content={`마지막 갱신 ${updatedAt.toLocaleString()}`} focusable>
            <span>{updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 갱신</span>
          </Tooltip>
        ) : '갱신 기록 없음'}
      </p>
      <div className="flex min-h-11 items-center gap-2 sm:min-h-10">
        <Toggle checked={autoRefresh} onChange={onAutoRefreshChange} disabled={disabled} ariaLabel="30초마다 자동 갱신" />
        <span className="type-caption text-text-muted">자동 갱신 30초</span>
      </div>
      <Button variant="secondary" collapseLabel loading={refreshing} disabled={disabled} onClick={onRefresh}>
        <MaterialIcon name="refresh" />새로고침
      </Button>
    </div>
  );
}
