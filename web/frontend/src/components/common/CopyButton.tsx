import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

// Copy actions are buttons that the Button component does not cover (§4.1), so
// the two shapes they take live here instead of being re-typed per screen.
// Heights are fixed like every other control — never built from px/py.
/** Primary copy action — matches a `sm` Button. */
export const COPY_ACTION_PRIMARY = 'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40';
/** Quiet copy action beside a field or code block. */
export const COPY_ACTION_SUBTLE = 'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40';

interface CopyButtonProps {
  onCopy: () => Promise<boolean> | boolean | void;
  title: string;
  className: string;
  children?: ReactNode;
  disabled?: boolean;
  copiedDurationMs?: number;
}

export function CopyButton({
  onCopy,
  title,
  className,
  children,
  disabled = false,
  copiedDurationMs = 3000,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = async () => {
    const didCopy = await onCopy();
    if (didCopy === false) return;

    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), copiedDurationMs);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={className}
      title={title}
      aria-label={title}
    >
      <MaterialIcon
        name={copied ? 'check' : 'content_copy'}
        className={copied ? 'text-emerald-500 dark:text-emerald-400' : ''}
      />
      {children}
    </button>
  );
}
