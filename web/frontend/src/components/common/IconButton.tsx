import type { ComponentPropsWithRef } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { Tooltip } from './Tooltip';

// 라벨 없는 아이콘 액션. Button은 라벨 있는 버튼 전용이라 정사각 형태는 여기서
// 관리한다 — 색·크기 규칙은 Button과 같다(§4.1). 화면마다 손으로 쓰던
// 옛 `text-slate-400 hover:text-accent` 문자열을 대체한다.

const TONES = {
  action: 'text-text not-aria-disabled:hover:bg-text/10 not-aria-disabled:active:bg-text/15',
  // 파괴 아이콘은 쉴 때 중립(muted)이고 hover·포커스에서만 붉다. 행마다 반복되는 붉은 휴지통이 목록의 오른쪽 끝에 색 기둥을
  // 만들어 시선이 이름보다 거기서 먼저 멈췄다(2026-11-20 시각 점검 3.2, DESIGN.md §4.1).
  danger: 'text-text-muted not-aria-disabled:hover:text-crit-text not-aria-disabled:hover:bg-crit-bg not-aria-disabled:focus-visible:text-crit-text not-aria-disabled:active:bg-crit/15',
  quiet: 'text-text-muted not-aria-disabled:hover:text-text not-aria-disabled:hover:bg-surface-hover not-aria-disabled:active:bg-border',
} as const;

// md는 터치 화면(sm 미만)에서 44px — Button md와 같은 규칙.
const SIZES = { sm: 'h-8 w-8', md: 'h-11 w-11 sm:h-10 sm:w-10' } as const;

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  // 비활성 이유를 키보드로도 확인해야 하면 aria-disabled를 쓴다.
  // hover·누름 반응은 TONES가 not-aria-disabled:로만 건다.
  'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed';

/** className을 받는 자리(CopyButton 등)에서 쓰는 조합. */
export const ICON_ACTION = `${BASE} ${TONES.action} ${SIZES.md}`;
export const ICON_ACTION_SM = `${BASE} ${TONES.action} ${SIZES.sm}`;

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: string;
  /** 접근 가능한 이름과 공통 툴팁 — 아이콘만 있으므로 필수다 */
  label: string;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  iconClassName?: string;
}

export function IconButton({
  icon,
  label,
  tone = 'action',
  size = 'md',
  iconClassName,
  className = '',
  title,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={title ?? label}><button
      type="button"
      aria-label={label}
      className={`${BASE} ${TONES[tone]} ${SIZES[size]} ${className}`}
      {...props}
    >
      <MaterialIcon name={icon} size={20} className={iconClassName} />
    </button></Tooltip>
  );
}

/**
 * 화면 데이터를 다시 불러오는 아이콘 버튼. 상용 모니터링 도구처럼 갱신 시각 옆에 아이콘만 둔다(DESIGN.md §4.1).
 * 불러오는 중에는 아이콘이 회전하고 눌리지 않는다.
 */
export function RefreshIconButton({ onClick, refreshing = false }: { onClick: () => void; refreshing?: boolean }) {
  return (
    <IconButton icon="refresh" label="새로고침" tone="quiet" onClick={onClick}
      disabled={refreshing} aria-busy={refreshing || undefined} iconClassName={refreshing ? 'animate-spin' : undefined} />
  );
}
