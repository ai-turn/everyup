import { ReactNode, useEffect, useRef } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import { Button } from './Button';

type Variant = 'danger' | 'primary';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  icon?: string;
  isProcessing?: boolean;
}

const variantStyles: Record<Variant, { iconBg: string; iconText: string; defaultIcon: string }> = {
  danger: {
    iconBg: 'bg-red-100 dark:bg-red-900/20',
    iconText: 'text-red-600 dark:text-red-400',
    defaultIcon: 'warning',
  },
  primary: {
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
    defaultIcon: 'help',
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  icon,
  isProcessing = false,
}: ConfirmDialogProps) {

  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  // Native <dialog> gives focus trapping, Escape handling, and focus restore.
  useEffect(() => {
    if (isOpen && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!isProcessing) onClose();
      }}
      onClick={(e) => {
        // ::backdrop clicks are delivered with the dialog itself as target.
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
      className={`m-auto bg-bg-surface border border-ui-border rounded-xl w-full max-w-md shadow-lg overflow-hidden animate-zoom-in ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="px-6 py-4 border-b border-ui-border flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${styles.iconBg}`}>
          <MaterialIcon size={20} name={icon ?? styles.defaultIcon} className={`${styles.iconText}`} />
        </div>
        <h2 id="confirm-dialog-title" className="type-section-title text-text-base">
          {title}
        </h2>
      </div>

      <div className="p-6">
        <div className="text-text-muted mb-2">{message}</div>
        {description && (
          <p className="text-sm text-text-dim">{description}</p>
        )}
      </div>

      <div className="px-6 pb-6 flex gap-3">
        <Button
          ref={cancelRef}
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1"
        >
          {cancelLabel ?? '취소'}
        </Button>
        <Button
          type="button"
          variant={variant}
          onClick={onConfirm}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <MaterialIcon size={20} name="sync" className="animate-spin" />
          ) : (
            <>
              {variant === 'danger' && <MaterialIcon size={20} name="delete" />}
              {confirmLabel ?? '삭제'}
            </>
          )}
        </Button>
      </div>
    </dialog>
  );
}
