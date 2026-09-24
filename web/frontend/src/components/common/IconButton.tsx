import type { ComponentPropsWithRef } from 'react';
import { MaterialIcon } from './MaterialIcon';

// 라벨 없는 아이콘 액션. Button은 라벨 있는 버튼 전용이라 정사각 형태는 여기서
// 관리한다 — 색·크기 규칙은 Button과 같다(§4.1). 화면마다 손으로 쓰던
// `text-slate-400 hover:text-primary` 문자열을 대체한다.

const TONES = {
  action: 'text-action hover:bg-action/10',
  danger: 'text-status-error hover:bg-status-error/10',
  quiet: 'text-text-muted hover:text-text-base hover:bg-ui-hover',
} as const;

// md는 터치 화면(sm 미만)에서 44px — Button md와 같은 규칙.
const SIZES = { sm: 'h-8 w-8', md: 'h-11 w-11 sm:h-10 sm:w-10' } as const;

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer ' +
  'disabled:opacity-50 disabled:pointer-events-none ' +
  // 이유를 title로 보여 줘야 하는 비활성은 aria-disabled — disabled는 hover를 막아 툴팁이 안 뜬다
  'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent';

/** className을 받는 자리(CopyButton 등)에서 쓰는 조합. */
export const ICON_ACTION = `${BASE} ${TONES.action} ${SIZES.md}`;
export const ICON_ACTION_SM = `${BASE} ${TONES.action} ${SIZES.sm}`;

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: string;
  /** aria-label + title — 아이콘만 있으므로 필수다 */
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
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${BASE} ${TONES[tone]} ${SIZES[size]} ${className}`}
      {...props}
    >
      <MaterialIcon name={icon} size={20} className={iconClassName} />
    </button>
  );
}
