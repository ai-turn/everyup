import { RefreshIconButton, Toggle, Tooltip } from '../../../components/common';
import { formatClock, formatFullDateTime } from '../../../utils/incidentFormat';

interface Props {
  updatedAt: Date | null;
  /** 둘 다 없으면 자동 갱신 스위치를 그리지 않는다(서버 목록은 갱신 시각만 보인다). */
  autoRefresh?: boolean;
  onAutoRefreshChange?: (enabled: boolean) => void;
  /** 있으면 갱신 시각 바로 뒤에 새로고침 아이콘 버튼을 둔다. */
  onRefresh?: () => void;
  /** 다시 불러오는 중이다. 아이콘이 회전하고 눌리지 않는다. */
  refreshing?: boolean;
}

/** 서버 데이터의 갱신 시각, 새로고침 버튼, 자동 갱신 스위치. 갱신에 관한 조작을 한 묶음으로 둔다. */
export function UptimeRefreshControls({ updatedAt, autoRefresh, onAutoRefreshChange, onRefresh, refreshing }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="서버 데이터 갱신">
      <p className="type-caption text-text-muted" aria-live="polite">
        {updatedAt ? (
          <Tooltip content={`마지막 갱신 ${formatFullDateTime(updatedAt)}`} focusable>
            <span>{formatClock(updatedAt, true)} 갱신</span>
          </Tooltip>
        ) : '갱신 기록 없음'}
      </p>
      {onRefresh && <RefreshIconButton onClick={onRefresh} refreshing={refreshing} />}
      {onAutoRefreshChange && (
        // 서버 머리말의 상태 줄(원인 링크)과 같은 높이로 낮춘다. 누르는 영역은 Toggle이 44px로 넓힌다.
        <div className="flex min-h-11 items-center gap-2 sm:min-h-6">
          <Toggle checked={Boolean(autoRefresh)} onChange={onAutoRefreshChange} ariaLabel="30초마다 자동 갱신" />
          <span className="type-caption text-text-muted">30초마다 자동 갱신</span>
        </div>
      )}
    </div>
  );
}
