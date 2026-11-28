import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FIELD_HEIGHT, FIELD_SHELL } from './Input';
import { MaterialIcon } from './MaterialIcon';
import { Tooltip } from './Tooltip';

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
  /** 감싼 <optgroup>의 label. 목록에서 묶음 제목으로 보인다. */
  group?: string;
}

function textFromNode(node: ReactNode): string {
  return Children.toArray(node).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');
}

function optionsFromChildren(children: ReactNode, group?: string): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const props = child.props as { value?: string | number; disabled?: boolean; label?: string; children?: ReactNode };
    if (child.type === 'optgroup') return optionsFromChildren(props.children, props.label);
    if (child.type !== 'option') return [];
    const label = textFromNode(props.children);
    return [{ value: String(props.value ?? label), label, disabled: Boolean(props.disabled), group }];
  });
}

/** 이어지는 같은 묶음의 선택지를 모은다. 묶음이 없는 선택지(전체 등)는 group이 없다. */
function sectionsOf(options: SelectOption[]): { group?: string; options: SelectOption[] }[] {
  const sections: { group?: string; options: SelectOption[] }[] = [];
  for (const option of options) {
    const last = sections[sections.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else sections.push({ group: option.group, options: [option] });
  }
  return sections;
}

type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'size'> & {
  wrapperClassName?: string;
  /** sm: 마우스 전용의 조밀한 자리(사이드바 데모 카드 등) 32px·12px. 기본 md는 입력과 같은 높이(터치 44 / 그 외 40). */
  size?: 'sm' | 'md';
};

// FIELD_SHELL의 text-sm·sm:h-10은 className으로 덮이지 않는다(같은 속성은 CSS 순서로 승패가 갈린다) — 크기는 여기서 고른다.
const TRIGGER_SIZE = {
  md: `${FIELD_SHELL} ${FIELD_HEIGHT}`,
  sm: 'w-full rounded-lg border bg-surface-hover px-2.5 h-8 text-xs text-text transition-colors',
} as const;

/** App-styled listbox that preserves native option and change-event semantics. */
export function Select({
  children,
  className = '',
  wrapperClassName = 'w-full',
  size = 'md',
  value,
  defaultValue,
  onChange,
  disabled = false,
  id,
  name,
  required,
  title,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  ...nativeProps
}: SelectProps) {
  const options = useMemo(() => optionsFromChildren(children), [children]);
  const controlledValue = value === undefined ? undefined : String(value);
  const [localValue, setLocalValue] = useState(() => String(defaultValue ?? options[0]?.value ?? ''));
  const [open, setOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLSelectElement>(null);
  const selectedValue = controlledValue ?? localValue;
  const selected = options.find((option) => option.value === selectedValue) ?? options[0];
  const menuId = id ? `${id}-menu` : `select-menu-${name ?? ariaLabel ?? 'field'}`;

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('pointerdown', closeOnOutside, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('pointerdown', closeOnOutside, true);
    };
  }, [open]);

  const selectValue = (nextValue: string) => {
    if (disabled) return;
    setLocalValue(nextValue);
    setOpen(false);
    if (nativeRef.current) {
      nativeRef.current.value = nextValue;
      nativeRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    buttonRef.current?.focus();
  };

  // The listbox must land inside the <dialog> that holds the trigger: a native
  // modal dialog renders in the top layer, above anything portaled to the body.
  const toggle = () => {
    setPortalTarget(buttonRef.current?.closest('dialog') ?? null);
    setOpen((current) => !current);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Enter' || event.key === ' ') {
      toggle();
      return;
    }
    const selectable = options.filter((option) => !option.disabled);
    const currentIndex = selectable.findIndex((option) => option.value === selectedValue);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    const next = selectable[(currentIndex + offset + selectable.length) % selectable.length];
    if (next) selectValue(next.value);
  };

  return (
    <span className={`relative block ${wrapperClassName}`}>
      <select ref={nativeRef} name={name} required={required} value={value} defaultValue={defaultValue} disabled={disabled} onChange={onChange} tabIndex={-1} aria-hidden="true" className="sr-only" {...nativeProps}>
        {children}
      </select>
      <Tooltip content={title}><button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={`${TRIGGER_SIZE[size]} inline-flex items-center justify-between gap-2 border-control text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <MaterialIcon size={20} name={open ? 'expand_less' : 'expand_more'} className="shrink-0 text-text-muted" />
      </button></Tooltip>
      {open && createPortal(
        <div ref={menuRef} id={menuId} role="listbox" aria-label={ariaLabel} style={{ top: position.top, left: position.left, width: position.width }} className="fixed z-[60] max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
          {sectionsOf(options).map((section, index) => {
            const items = section.options.map((option) => {
              const isSelected = option.value === selectedValue;
              // 모바일에서 누르는 높이 44px. 데스크톱은 36px 그대로다.
              return (
                <button key={option.value} type="button" role="option" aria-selected={isSelected} disabled={option.disabled} onClick={() => selectValue(option.value)} className={`flex min-h-11 w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 ${isSelected ? 'bg-accent-bg font-medium text-text' : 'text-text hover:bg-surface-hover'}`}>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected && <MaterialIcon size={20} name="check" className="ml-2 shrink-0" />}
                </button>
              );
            });
            if (section.group === undefined) return items;
            // 네이티브 <optgroup>과 같이 묶음 제목은 고를 수 없다. 이름은 group의 aria-label이 말한다.
            return (
              <div key={`group-${index}`} role="group" aria-label={section.group}>
                <div aria-hidden="true" className="px-3 pb-1 pt-2 type-label-sm text-text-muted">{section.group}</div>
                {items}
              </div>
            );
          })}
        </div>,
        portalTarget ?? document.body,
      )}
    </span>
  );
}
