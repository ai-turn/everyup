import type { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { Button } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Action slot for triggers that own their own state (e.g. a dialog opener). */
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, action, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-ui-hover flex items-center justify-center mb-6">
        <MaterialIcon size={36} name={icon} className="text-text-dim" />
      </div>
      <h3 className="type-section-title text-text-base mb-2 text-center">
        {title}
      </h3>
      {description && (
        <p className="text-text-muted text-center max-w-md mb-6">
          {description}
        </p>
      )}
      {action ? (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      ) : children}
    </div>
  );
}
