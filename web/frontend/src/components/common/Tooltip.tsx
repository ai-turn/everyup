import { cloneElement, useState, type HTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react';
import {
  autoUpdate, flip, FloatingDelayGroup, FloatingPortal, hide, offset, safePolygon, shift,
  useDelayGroup, useDismiss, useFloating, useFocus, useHover, useInteractions, useMergeRefs, useRole,
} from '@floating-ui/react';

type TriggerProps = HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> };
interface TooltipProps {
  content?: string;
  children: ReactElement<TriggerProps>;
  /** 독립된 읽기 전용 힌트에만 Tab 지점을 추가한다. 버튼·링크는 자체 포커스를 쓴다. */
  focusable?: boolean;
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <FloatingDelayGroup delay={{ open: 400, close: 100 }}>{children}</FloatingDelayGroup>;
}

/** DOM 래퍼를 추가하지 않아 표 셀·말줄임·flex 배치를 유지한다. */
export function Tooltip({ content, children, focusable = false }: TooltipProps) {
  return content ? <TooltipHint content={content} focusable={focusable}>{children}</TooltipHint> : children;
}

function TooltipHint({ content, children, focusable }: TooltipProps & { content: string }) {
  const [open, setOpen] = useState(false);
  const { refs: { setReference, setFloating }, elements, floatingStyles, context, middlewareData } = useFloating<HTMLElement>({
    open,
    onOpenChange: (nextOpen, event) => {
      // Escape는 힌트만 닫는다. 네이티브 dialog의 기본 닫기도 막아야 한다.
      if (!nextOpen && event instanceof KeyboardEvent && event.key === 'Escape') event.preventDefault();
      setOpen(nextOpen);
    },
    placement: 'top',
    strategy: 'fixed',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 }), hide()],
    whileElementsMounted: autoUpdate,
  });
  const { delay } = useDelayGroup(context);
  const hover = useHover(context, { delay, move: false, mouseOnly: true, handleClose: safePolygon() });
  const focus = useFocus(context);
  const dismiss = useDismiss(context, { referencePress: true, referencePressEvent: 'click', bubbles: { escapeKey: false } });
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);
  const ref = useMergeRefs([setReference, children.props.ref]);
  const { 'aria-describedby': existingDescription, ...triggerProps } = children.props;
  const referenceProps = getReferenceProps({
    ...triggerProps,
    onFocus(event: React.FocusEvent<HTMLElement>) {
      children.props.onFocus?.(event);
      // hover 중 Escape로 닫은 뒤에도 새로 받은 키보드 포커스는 힌트를 연다.
      if (!event.defaultPrevented && event.currentTarget.matches(':focus-visible')) {
        context.onOpenChange(true, event.nativeEvent, 'focus');
      }
    },
  });
  const describedBy = [...new Set([
    existingDescription, referenceProps['aria-describedby'],
  ].filter(Boolean).join(' ').split(/\s+/))].filter(Boolean).join(' ') || undefined;

  return <>
    {cloneElement(children, {
      ...referenceProps,
      ref,
      title: undefined,
      tabIndex: children.props.tabIndex ?? (focusable ? 0 : undefined),
      'aria-describedby': describedBy,
    })}
    {open && <FloatingPortal root={elements.domReference?.closest('dialog') ?? undefined}>
      <div
        ref={setFloating}
        style={{ ...floatingStyles, visibility: middlewareData.hide?.referenceHidden ? 'hidden' : undefined }}
        className="z-[70] max-h-[calc(100dvh-16px)] w-max max-w-[min(20rem,calc(100vw-16px))] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-xs font-normal leading-5 text-text-base shadow-lg"
        {...getFloatingProps({ onClick: (event: React.MouseEvent) => event.stopPropagation() })}
      >{content}</div>
    </FloatingPortal>}
  </>;
}
