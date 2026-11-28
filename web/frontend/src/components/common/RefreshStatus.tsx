import { useEffect, useState } from 'react';
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

/** 지난 시간을 짧게: 1분 안은 초, 1시간 안은 분, 그 뒤는 시각. */
function ago(from: Date, now: number): string {
  const sec = Math.max(0, Math.round((now - from.getTime()) / 1000));
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return formatClock(from);
}

/**
 * 갱신 상태 한 묶음(DESIGN.md §4.1, G안): `● 마지막 확인 8초 전`, 새로고침, 30초 자동 갱신 스위치. 메뉴 첫 화면은 상단 줄 오른쪽,
 * 상세 화면은 머리말 상태 줄의 오른쪽 끝이다. 점은 자동 갱신이 켜져 있으면 초록, 꺼져 있으면 회색이다.
 * 지난 시간은 1초마다 바뀌므로 화면 낭독기에는 읽히지 않고, 갱신 시각(`12:00:00 갱신`)만 바뀔 때 알린다.
 */
export function RefreshStatus({ updatedAt, autoRefresh, onAutoRefreshChange, onRefresh, refreshing }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const live = autoRefresh ?? true;
  return (
    // 넓은 화면에서는 새로고침 버튼(40px)이 상태 줄(24px)을 키우지 않게 위아래로 8px씩 펼친다(sm:-my-2, bleed). 터치 화면은 44px 그대로다.
    <div className="flex flex-wrap items-center gap-2 sm:-my-2" role="group" aria-label="데이터 갱신">
      <p className="flex items-center gap-1.5 type-caption text-text-faint">
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${updatedAt && live ? 'bg-ok' : 'bg-wait'}`} />
        {updatedAt ? (
          <Tooltip content={`마지막 갱신 ${formatFullDateTime(updatedAt)}`} focusable>
            <span>
              <span aria-hidden="true">마지막 확인 {ago(updatedAt, now)}</span>
              <span className="sr-only" aria-live="polite">{formatClock(updatedAt, true)} 갱신</span>
            </span>
          </Tooltip>
        ) : '갱신 기록 없음'}
      </p>
      {onRefresh && <RefreshIconButton onClick={onRefresh} refreshing={refreshing} />}
      {onAutoRefreshChange && (
        // 스위치의 이름과 툴팁이 "30초마다 자동 갱신"을 말한다. 상단 줄을 짧게 두려고 글자는 붙이지 않는다.
        <div className="flex min-h-11 items-center sm:min-h-6">
          <Toggle checked={Boolean(autoRefresh)} onChange={onAutoRefreshChange} ariaLabel="30초마다 자동 갱신" title="30초마다 자동 갱신" />
        </div>
      )}
    </div>
  );
}
