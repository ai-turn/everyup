// 아이콘이 붙은 검색 입력.
// 이전엔 5곳이 각자 아이콘을 `absolute left-2/2.5/10`으로 놓고 그에 맞춰 `pl-7/8/10`을
// 손으로 맞췄다 — 아이콘 위치와 패딩이 따로 노는 구조라 한쪽만 고치면 어긋난다.
// 여기서는 둘을 한 쌍으로 묶어 호출부가 간격을 알 필요가 없게 한다.
// 지우기 버튼도 같은 이유로 여기 있다(알림 규칙·발송 이력·로그가 각자 absolute로 얹고 있었다).

import { useEffect, useRef, type ComponentPropsWithRef } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface SearchInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** 래퍼에 붙일 클래스 — 폭(`w-64`, `flex-1`)은 여기로 준다. */
  wrapperClassName?: string;
  /** 값이 있을 때 입력 안 오른쪽에 지우기(✕)를 둔다. 누르면 이 콜백을 부르고 입력에 포커스를 돌려준다. */
  onClear?: () => void;
  /**
   * `/`로 이 입력에 포커스한다(목록의 주 검색 하나에만). 비어 있고 포커스가 없을 때 `/` 힌트를 보인다.
   * 다른 입력·편집 영역에 있을 때와 수정키 조합은 가로채지 않는다.
   */
  shortcut?: boolean;
}

export function SearchInput({ wrapperClassName = '', className = '', onClear, shortcut = false, ref, ...props }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasValue = props.value !== undefined ? String(props.value) !== '' : false;

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div className={`group relative ${wrapperClassName}`}>
      <MaterialIcon size={16}
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim transition-colors group-focus-within:text-text-base"
      />
      {/* 경계는 3:1(ui-control-border, DESIGN.md §1.2)을 지킨다. 포커스는 전역 외곽선 대신 경계를 글자색으로
          바꾸고 옅은 후광을 둔다 — 경계와 링이 2px 떨어져 겹쳐 보이던 것을 하나로 합쳤다. */}
      <input
        ref={setRefs}
        type="text"
        className={
          'h-11 sm:h-10 w-full rounded-lg border border-ui-control-border bg-bg-surface pl-9 ' +
          `${onClear || shortcut ? 'pr-10' : 'pr-3'} text-sm max-sm:text-base text-text-base placeholder:text-text-dim ` +
          'transition-[border-color,box-shadow] hover:border-text-muted ' +
          'focus-visible:outline-none focus:border-action focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_12%,transparent)] ' +
          className
        }
        {...props}
      />
      {onClear && hasValue ? (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => { onClear(); inputRef.current?.focus(); }}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-ui-hover hover:text-text-base"
        >
          <MaterialIcon size={16} name="close" />
        </button>
      ) : shortcut && !hasValue && (
        <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-ui-border px-1.5 font-sans type-label-sm text-text-muted sm:block sm:group-focus-within:hidden">/</kbd>
      )}
    </div>
  );
}
