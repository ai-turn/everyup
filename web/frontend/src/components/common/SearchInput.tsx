// 아이콘이 붙은 검색 입력.
// 이전엔 5곳이 각자 아이콘을 `absolute left-2/2.5/10`으로 놓고 그에 맞춰 `pl-7/8/10`을
// 손으로 맞췄다 — 아이콘 위치와 패딩이 따로 노는 구조라 한쪽만 고치면 어긋난다.
// 여기서는 둘을 한 쌍으로 묶어 호출부가 간격을 알 필요가 없게 한다.

import type { ComponentPropsWithRef } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface SearchInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** 래퍼에 붙일 클래스 — 폭(`w-64`, `flex-1`)은 여기로 준다. */
  wrapperClassName?: string;
}

export function SearchInput({ wrapperClassName = '', className = '', ...props }: SearchInputProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <MaterialIcon size={20}
        name="search"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
      />
      <input
        type="text"
        className={
          'h-11 sm:h-10 w-full rounded-lg border border-ui-border bg-bg-surface pl-8 pr-3 ' +
          `text-sm text-text-base placeholder:text-text-dim transition-colors ${className}`
        }
        {...props}
      />
    </div>
  );
}
