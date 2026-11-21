import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  autoUpdate, flip, FloatingFocusManager, FloatingPortal, offset, shift,
  useClick, useDismiss, useFloating, useInteractions, useListNavigation, useRole,
} from '@floating-ui/react';
import { MaterialIcon } from './MaterialIcon';
import { Tooltip } from './Tooltip';

export interface OverflowMenuItem {
  label: string;
  icon?: string;
  /** 누르면 실행한다. `to`와 둘 중 하나. */
  onSelect?: () => void;
  /** 다른 화면으로 가는 항목. */
  to?: string;
  /** 파괴적 항목(삭제, 비활성화, 연결 해제). 글자가 붉다. 메뉴 끝에 둔다. */
  danger?: boolean;
  disabled?: boolean;
  /** 비활성인 이유. 툴팁과 스크린리더 설명으로 보인다. */
  disabledReason?: string;
}

/**
 * 상세 머리말의 `더보기` 메뉴(DESIGN.md §4.1 상세 헤더). 드물게 쓰는 조작과 파괴적 조작을 여기에 둔다 — 머리말에는 주 조작
 * 하나와 이 메뉴만 보인다. 버튼은 `IconButton`과 같은 40px(터치 44px) 정사각이다. 메뉴는 `role="menu"`이고 화살표로 옮기며
 * Esc나 바깥을 누르면 닫히고 포커스가 버튼으로 돌아온다.
 */
export function OverflowMenu({ items, label = '더보기' }: { items: OverflowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const listRef = useRef<(HTMLElement | null)[]>([]);
  const { refs: { setReference, setFloating }, floatingStyles, context, elements } = useFloating({
    open, onOpenChange: setOpen, placement: 'bottom-end', whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context), useDismiss(context), useRole(context, { role: 'menu' }),
    useListNavigation(context, { listRef, activeIndex: active, onNavigate: setActive, loop: true }),
  ]);
  if (items.length === 0) return null;
  // 고른 항목이 대화 상자를 열면, 닫힐 때 포커스가 사라진 메뉴 항목이 아니라 이 버튼으로 돌아오게 먼저 버튼에 둔다.
  const choose = (item: OverflowMenuItem) => { setOpen(false); (elements.domReference as HTMLElement | null)?.focus(); item.onSelect?.(); };
  const itemClass = (item: OverflowMenuItem) => `flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left type-control transition-colors sm:min-h-9 focus-visible:bg-ui-hover not-aria-disabled:hover:bg-ui-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${item.danger ? 'text-status-error' : 'text-text-base'}`;
  return (
    <>
      <Tooltip content={label}>
        <button ref={setReference} type="button" aria-label={label}
          className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-ui-hover hover:text-text-base aria-expanded:bg-ui-hover sm:h-10 sm:w-10"
          {...getReferenceProps()}>
          <MaterialIcon name="more_vert" />
        </button>
      </Tooltip>
      {open && (
        <FloatingPortal root={elements.domReference?.closest('dialog') ?? undefined}>
          <FloatingFocusManager context={context} modal={false} initialFocus={0}>
            <div ref={setFloating} style={floatingStyles} aria-label={label}
              className="z-[60] min-w-44 rounded-lg border border-ui-border bg-ui-raised p-1 shadow-lg"
              {...getFloatingProps()}>
              {items.map((item, index) => {
                const setItem = (node: HTMLElement | null) => { listRef.current[index] = node; };
                const props = getItemProps({
                  role: 'menuitem',
                  tabIndex: active === index ? 0 : -1,
                  'aria-disabled': item.disabled || undefined,
                  onClick: (event) => { if (item.disabled) { event.preventDefault(); return; } choose(item); },
                });
                const body = <>{item.icon && <MaterialIcon size={20} name={item.icon} className="shrink-0" />}<span className="min-w-0 flex-1 truncate">{item.label}</span></>;
                const node = item.to && !item.disabled
                  ? <Link key={item.label} ref={setItem} to={item.to} className={itemClass(item)} {...props}>{body}</Link>
                  : <button key={item.label} ref={setItem} type="button" className={itemClass(item)} {...props}>{body}</button>;
                return item.disabled && item.disabledReason
                  ? <Tooltip key={item.label} content={item.disabledReason}>{node}</Tooltip>
                  : node;
              })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
