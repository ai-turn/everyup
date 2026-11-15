// 아이콘이 붙은 검색 입력. 생김새와 동작은 Astryx PowerSearch(meta/astryx)를 참고했다:
// 한 줄 상자 안에 돋보기·입력·결과 수(스크린리더에 polite로 알림)·지우기가 흐른다.
// 테두리와 포커스 링은 래퍼가 갖는다 — 오른쪽 요소의 폭이 바뀌어도 입력 패딩을 손으로 맞출 필요가 없다
// (예전엔 호출부마다 `pr-10` + absolute 버튼을 얹었다).

import { useEffect, useRef, type ComponentPropsWithRef } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { IconButton } from './IconButton';

interface SearchInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** 래퍼에 붙일 클래스 — 폭(`w-64`, `flex-1`)은 여기로 준다. */
  wrapperClassName?: string;
  /** 값이 있을 때 안쪽 오른쪽에 지우기(✕)를 둔다. 누르면 이 콜백을 부르고 입력에 포커스를 돌려준다. */
  onClear?: () => void;
  /**
   * 검색 결과 요약. 검색어가 있을 때만 보인다 — 전체 수는 목록 제목 줄이 이미 말한다.
   * 숫자면 `N개`, 문자열이면 그대로(무엇을 셌는지 숫자만으로 모호할 때). 바뀌면 스크린리더에 polite로 알린다.
   */
  resultCount?: number | string;
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
    // 경계는 다른 입력과 같은 ui-control-border(3:1, DESIGN.md §1.2). 포커스는 전역 :focus-visible과 같은
    // 2px action 외곽선을 래퍼에 그린다 — 입력 자신의 외곽선은 래퍼 안에 갇혀 이중 링이 되므로 끈다.
    <div
      className={
        'flex h-11 sm:h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-ui-control-border bg-bg-surface pl-3 pr-1 ' +
        'hover:border-text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action ' +
        wrapperClassName
      }
    >
      <MaterialIcon name="search" className="pointer-events-none shrink-0 text-text-dim" />
      <input
        ref={setRefs}
        type="text"
        aria-keyshortcuts={shortcut ? '/' : undefined}
        className={
          'peer h-full min-w-0 flex-1 bg-transparent text-sm max-sm:text-base text-text-base placeholder:text-text-dim ' +
          `focus-visible:outline-none ${className}`
        }
        {...props}
      />
      {resultCount !== undefined && (
        <span aria-live="polite" className="shrink-0 whitespace-nowrap type-caption tabular-nums text-text-muted">
          {hasValue ? (typeof resultCount === 'number' ? `${resultCount.toLocaleString()}개` : resultCount) : ''}
        </span>
      )}
      {onClear && hasValue ? (
        <IconButton icon="close" label="검색어 지우기" tone="quiet" size="sm" onClick={() => { onClear(); inputRef.current?.focus(); }} />
      ) : shortcut && !hasValue && (
        <kbd aria-hidden="true" className="mr-1.5 hidden shrink-0 rounded border border-ui-border px-1.5 font-sans type-label-sm text-text-muted sm:block sm:peer-focus:hidden">/</kbd>
      )}
    </div>
  );
}
