import { Button, MaterialIcon, Toggle, Tooltip } from '../../../components/common';

interface Props {
  updatedAt: Date | null;
  refreshing: boolean;
  /** 둘 다 없으면 자동 갱신 스위치를 그리지 않는다(서버 목록은 갱신 시각만 보인다). */
  autoRefresh?: boolean;
  onAutoRefreshChange?: (enabled: boolean) => void;
  /** 없으면 새로고침 버튼을 그리지 않는다. 화면의 새로고침이 이미 따로 있을 때(서버 상세). */
  onRefresh?: () => void;
  disabled?: boolean;
  /** 묶음의 접근 가능한 이름. 서버 화면은 서버 데이터의 갱신이다. */
  label?: string;
}

export function UptimeRefreshControls({ updatedAt, refreshing, autoRefresh, onAutoRefreshChange, onRefresh, disabled, label = '업타임 갱신' }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label={label}>
      <p className="type-caption text-text-muted" aria-live="polite">
        {refreshing ? '갱신 중' : updatedAt ? (
          <Tooltip content={`마지막 갱신 ${updatedAt.toLocaleString()}`} focusable>
            <span>{updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 갱신</span>
          </Tooltip>
        ) : '갱신 기록 없음'}
      </p>
      {/* 스위치의 누르는 영역은 Toggle이 44px로 넓힌다. 데스크톱에서는 상태 줄의 다른 항목(원인 링크)과 같은 높이다. */}
      {onAutoRefreshChange && (
        <div className="flex min-h-11 items-center gap-2 sm:min-h-6">
          <Toggle checked={Boolean(autoRefresh)} onChange={onAutoRefreshChange} disabled={disabled} ariaLabel="30초마다 자동 갱신" />
          <span className="type-caption text-text-muted">30초마다 자동 갱신</span>
        </div>
      )}
      {onRefresh && <Button collapseLabel loading={refreshing} disabled={disabled} onClick={onRefresh}>
        <MaterialIcon name="refresh" />새로고침
      </Button>}
    </div>
  );
}
