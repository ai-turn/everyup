import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FIELD_HEIGHT, FIELD_SHELL } from './Input';
import { MaterialIcon } from './MaterialIcon';

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
}

function textFromNode(node: ReactNode): string {
  return Children.toArray(node).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');
}

function optionsFromChildren(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
    if (child.type === 'optgroup') return optionsFromChildren(props.children);
    if (child.type !== 'option') return [];
    const label = textFromNode(props.children);
    return [{ value: String(props.value ?? label), label, disabled: Boolean(props.disabled) }];
  });
}

type SelectProps = ComponentPropsWithoutRef<'select'> & { wrapperClassName?: string };

/** App-styled listbox that preserves native option and change-event semantics. */
export function Select({
  children,
  className = '',
  wrapperClassName = 'w-full',
  value,
  defaultValue,
  onChange,
  disabled = false,
  id,
  name,
  required,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
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
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={`${FIELD_SHELL} ${FIELD_HEIGHT} inline-flex items-center justify-between gap-2 border-ui-border text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <MaterialIcon size={20} name={open ? 'expand_less' : 'expand_more'} className="shrink-0 text-text-muted" />
      </button>
      {open && createPortal(
        <div ref={menuRef} id={menuId} role="listbox" aria-label={ariaLabel} style={{ top: position.top, left: position.left, width: position.width }} className="fixed z-[60] max-h-64 overflow-y-auto rounded-lg border border-ui-border bg-bg-surface p-1 shadow-lg">
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            return (
              <button key={option.value} type="button" role="option" aria-selected={isSelected} disabled={option.disabled} onClick={() => selectValue(option.value)} className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? 'bg-primary/10 font-medium text-primary' : 'text-text-secondary hover:bg-ui-hover'}`}>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected && <MaterialIcon size={20} name="check" className="ml-2 shrink-0" />}
              </button>
            );
          })}
        </div>,
        portalTarget ?? document.body,
      )}
    </span>
  );
}
