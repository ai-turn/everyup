import type { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { Button, ButtonLink } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  /** `to`면 링크(ButtonLink) — 다른 화면으로 가는 액션은 `<a href>`여야 한다. */
  action?: { label: string; onClick: () => void } | { label: string; to: string };
  /** Action slot for triggers that own their own state (e.g. a dialog opener). */
  children?: ReactNode;
  /** 제목의 단계. 페이지에서 h1 다음에 바로 오면 h2를 넘긴다. 화면 전체가 이 안내이면 h1이다. */
  headingLevel?: 'h1' | 'h2' | 'h3';
}

export function EmptyState({ icon, title, description, action, children, headingLevel: Heading = 'h3' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-ui-hover flex items-center justify-center mb-6">
        <MaterialIcon size={36} name={icon} className="text-text-dim" />
      </div>
      <Heading className="type-section-title text-text-base mb-2 text-center">
        {title}
      </Heading>
      {description && (
        <p className="text-text-muted text-center max-w-md mb-6">
          {description}
        </p>
      )}
      {action ? (
        'to' in action
          ? <ButtonLink to={action.to}>{action.label}</ButtonLink>
          : <Button onClick={action.onClick}>{action.label}</Button>
      ) : children}
    </div>
  );
}
