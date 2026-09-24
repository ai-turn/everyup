// 라벨 있는 액션 버튼의 단일 소스.
// 이전엔 primary 버튼 클래스 문자열만 13종이라 높이·radius·굵기가 화면마다 어긋났다.
//
// 크기는 **높이로 고정**한다 (px/py 조합 금지) — 나란히 놓았을 때 밑변이 맞아야 한다.
// 아이콘 전용 버튼은 IconButton이다.

import { Children, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { MaterialIcon } from './MaterialIcon';

// 액션에는 색을 싣는다 (§5.3). 채움도 보더도 없는 버튼이 본문과 같은 회색이면
// 눈에 들어오지 않아 hover 전까지 버튼인지 읽히지 않았다. `action`은 표면·hover
// 배경 위에서 AA를 만족하는 primary 변주다 (§1.4).
// 색 override는 className으로 하지 않는다 — Tailwind가 같은 속성의 유틸리티를
// 알파벳 순으로 내보내서 `text-status-error`가 `text-text-muted`에 밀렸다.
// 파괴적 액션은 variant로 고른다.
const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-bg-surface border border-ui-border text-text-base hover:bg-ui-hover [&_svg]:text-action',
  ghost: 'text-action hover:bg-action/10',
  // secondary와 같은 모양에 글자·아이콘만 빨갛게 — 툴바에 나란히 놓였을 때 모양으로 튀지 않는다.
  destructive: 'bg-bg-surface border border-ui-border text-status-error hover:bg-status-error/10',
  quiet: 'text-text-muted hover:text-text-base hover:bg-ui-hover',
  danger: 'bg-red-600 text-white hover:bg-red-700',
} as const;

// md는 터치 화면(sm 미만)에서 44px — Apple 44pt·Material 48dp 권장 터치 영역에 맞춘다.
// 입력(FIELD_HEIGHT)·검색·IconButton md·SegmentedControl md가 같은 규칙이라 줄이 맞는다.
const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1',
  md: 'h-11 px-4 text-sm gap-1.5 sm:h-10',
} as const;

// focus-visible 링은 index.css의 전역 규칙이 처리한다 — 여기서 중복 정의하지 않는다.
// 이유를 보여 줘야 하는 비활성은 `disabled` 대신 `aria-disabled`를 쓴다 — `disabled`는
// 포커스·hover를 막아 title 툴팁과 스크린리더 안내가 사라진다.
const BASE =
  'inline-flex items-center justify-center shrink-0 rounded-lg font-medium transition-colors cursor-pointer ' +
  'disabled:opacity-50 disabled:pointer-events-none ' +
  'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent ' +
  // loading 중엔 스피너만 남기고 호출부의 아이콘은 숨긴다
  'aria-busy:[&>svg:not(:first-child)]:hidden';

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

// sm(640px) 미만에서 라벨을 시각적으로 숨기고 아이콘만 남긴다. 라벨은 sr-only로 남아
// 접근 가능한 이름이 되고, 같은 문구를 title(툴팁)로도 준다. 툴바가 좁은 화면에서
// 두세 줄로 쪼개지던 것을 한 줄에 담기 위한 것이라 아이콘이 있는 버튼에만 쓴다.
function collapsible(children: ReactNode) {
  const label = Children.toArray(children).filter((c) => typeof c === 'string' || typeof c === 'number').join('');
  const content = Children.map(children, (c) =>
    typeof c === 'string' || typeof c === 'number' ? <span className="max-sm:sr-only">{c}</span> : c,
  );
  return { label, content, className: 'max-sm:w-11 max-sm:px-0' };
}

function buttonClass(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

// ComponentPropsWithRef: React 19는 ref를 일반 prop으로 넘긴다 (forwardRef 불필요).
interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  size?: Size;
  /** 진행 중 — 라벨은 그대로 두고 스피너를 앞에 붙인다. 폭이 흔들리지 않는다. */
  loading?: boolean;
  /** sm 미만에서 아이콘만 — 상세 툴바처럼 한 줄에 여러 개가 놓이는 자리 */
  collapseLabel?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  collapseLabel = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const c = collapseLabel ? collapsible(children) : null;
  return (
    <button
      className={buttonClass(variant, size, `${c?.className ?? ''} ${className}`)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={c?.label}
      {...props}
    >
      {loading && <MaterialIcon name="sync" className="animate-spin" />}
      {c ? c.content : children}
    </button>
  );
}

/** 다른 화면으로 가는 버튼 모양 — 이동은 `<a href>`여야 새 탭·주소 미리보기·"링크" 낭독이 된다. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  collapseLabel = false,
  className = '',
  children,
  ...props
}: LinkProps & { variant?: Variant; size?: Size; collapseLabel?: boolean }) {
  const c = collapseLabel ? collapsible(children) : null;
  return (
    <Link className={buttonClass(variant, size, `${c?.className ?? ''} ${className}`)} title={c?.label} {...props}>
      {c ? c.content : children}
    </Link>
  );
}
