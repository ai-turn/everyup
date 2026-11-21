import { RefreshIconButton } from './IconButton';
import { Toggle } from './Toggle';
import { Tooltip } from './Tooltip';
import { formatClock, formatFullDateTime } from '../../utils/incidentFormat';

interface Props {
  updatedAt: Date | null;
  /** 둘 다 없으면 자동 갱신 스위치를 그리지 않는다(서버 목록은 갱신 시각과 새로고침만 보인다). */
  autoRefresh?: boolean;
  onAutoRefreshChange?: (enabled: boolean) => void;
  /** 있으면 갱신 시각 바로 뒤에 새로고침 아이콘 버튼을 둔다. */
  onRefresh?: () => void;
  /** 다시 불러오는 중이다. 아이콘이 회전하고 눌리지 않는다. */
  refreshing?: boolean;
}

/**
 * 갱신 상태 한 묶음(DESIGN.md §4.1 상세 헤더): 마지막 갱신 시각, 새로고침, 30초 자동 갱신 스위치. 상세 화면은 머리말 상태 줄의
 * 오른쪽 끝에 둔다. 이전에는 화면마다 아이콘만, 시각과 아이콘, 글자로만 적은 자동 갱신 등 다섯 모양이었다(2026-11-20 점검 B2).
 * 좁은 화면에서는 스위치 옆 글자를 숨기고 스위치의 이름과 툴팁으로 말한다 — 머리말이 한 줄 더 길어졌다.
 */
export function RefreshStatus({ updatedAt, autoRefresh, onAutoRefreshChange, onRefresh, refreshing }: Props) {
  return (
    // 넓은 화면에서는 새로고침 버튼(40px)이 상태 줄(24px)을 키우지 않게 위아래로 8px씩 펼친다(sm:-my-2, bleed). 터치 화면은 44px 그대로다.
    <div className="flex flex-wrap items-center gap-3 sm:-my-2" role="group" aria-label="데이터 갱신">
      <p className="type-caption text-text-muted" aria-live="polite">
        {updatedAt ? (
          <Tooltip content={`마지막 갱신 ${formatFullDateTime(updatedAt)}`} focusable>
            <span>{formatClock(updatedAt, true)} 갱신</span>
          </Tooltip>
        ) : '갱신 기록 없음'}
      </p>
      {onRefresh && <RefreshIconButton onClick={onRefresh} refreshing={refreshing} />}
      {onAutoRefreshChange && (
        // 머리말의 상태 줄(원인 링크)과 같은 높이로 낮춘다. 누르는 영역은 Toggle이 44px로 넓힌다.
        <div className="flex min-h-11 items-center gap-2 sm:min-h-6">
          <Toggle checked={Boolean(autoRefresh)} onChange={onAutoRefreshChange} ariaLabel="30초마다 자동 갱신" title="30초마다 자동 갱신" />
          <span className="hidden type-caption text-text-muted sm:inline">30초마다 자동 갱신</span>
        </div>
      )}
    </div>
  );
}
