// 아이콘이 붙은 검색 입력. 생김새와 동작은 Astryx PowerSearch(meta/astryx)를 참고했다:
// 옅은 경계의 한 줄 상자, 안쪽 오른쪽의 결과 수(스크린리더에 polite로 알림), 지우기.
// 테두리는 래퍼가 갖고 아이콘·입력·결과 수·지우기가 한 줄로 흐른다 — 오른쪽 요소의 폭이 바뀌어도
// 입력 패딩을 손으로 맞출 필요가 없다(예전엔 호출부마다 `pr-10` + absolute 버튼을 얹었다).

import { useEffect, useRef, type ComponentPropsWithRef } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface SearchInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** 래퍼에 붙일 클래스 — 폭(`w-64`, `flex-1`)은 여기로 준다. */
  wrapperClassName?: string;
  /** 값이 있을 때 안쪽 오른쪽에 지우기(✕)를 둔다. 누르면 이 콜백을 부르고 입력에 포커스를 돌려준다. */
  onClear?: () => void;
  /**
   * 검색어에 맞는 항목 수. 검색어가 있을 때만 `N개`로 보인다 — 전체 수는 목록 제목 줄이 이미 말한다.
   * 바뀔 때 스크린리더에 polite로 알린다.
   */
  resultCount?: number;
  /**
   * `/`로 이 입력에 포커스한다(목록의 주 검색 하나에만). 비어 있고 포커스가 없을 때 `/` 힌트를 보인다.
   * 다른 입력·편집 영역에 있을 때와 수정키 조합은 가로채지 않는다.
   */
  shortcut?: boolean;
}

export function SearchInput({ wrapperClassName = '', className = '', onClear, resultCount, shortcut = false, ref, ...props }: SearchInputProps) {
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
    // 쉴 때는 옅은 경계(ui-border), 올리면 컨트롤 경계(3:1), 포커스면 글자색 경계 + 12% 후광.
    // 검색 상자임은 앞의 돋보기와 placeholder가 함께 말한다(DESIGN.md §6 SearchInput).
    <div
      className={
        'group flex h-11 sm:h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-ui-border bg-bg-surface pl-3 pr-1.5 ' +
        'transition-[border-color,box-shadow] hover:border-ui-control-border ' +
        'focus-within:border-action focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_12%,transparent)] ' +
        wrapperClassName
      }
    >
      <MaterialIcon size={16}
        name="search"
        className="pointer-events-none shrink-0 text-text-dim transition-colors group-focus-within:text-text-base"
      />
      <input
        ref={setRefs}
        type="text"
        className={
          'h-full min-w-0 flex-1 bg-transparent text-sm max-sm:text-base text-text-base placeholder:text-text-dim ' +
          `focus-visible:outline-none ${className}`
        }
        {...props}
      />
      {resultCount !== undefined && (
        <span aria-live="polite" className="shrink-0 whitespace-nowrap type-caption tabular-nums text-text-muted">
          {hasValue ? `${resultCount.toLocaleString()}개` : ''}
        </span>
      )}
      {onClear && hasValue ? (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => { onClear(); inputRef.current?.focus(); }}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-ui-hover hover:text-text-base"
        >
          <MaterialIcon size={16} name="close" />
        </button>
      ) : shortcut && !hasValue && (
        <kbd aria-hidden="true" className="mr-1 hidden shrink-0 rounded border border-ui-border px-1.5 font-sans type-label-sm text-text-muted sm:block sm:group-focus-within:hidden">/</kbd>
      )}
    </div>
  );
}
