import type { ReactNode } from 'react';

interface ListToolbarProps {
  search: ReactNode;
  children?: ReactNode;
  inline?: boolean;
}

export function ListToolbar({ search, children, inline = false }: ListToolbarProps) {
  return (
    <div className={`mb-6 flex gap-3 ${inline ? 'items-start' : 'flex-col sm:flex-row sm:flex-wrap sm:items-start'}`}>
      <div className={inline ? 'min-w-0 flex-1 sm:max-w-80' : 'w-full min-w-0 sm:w-80 sm:shrink-0'}>{search}</div>
      {children && <div className={`flex min-w-0 flex-wrap items-center gap-2 ${inline ? 'ml-auto shrink-0' : 'flex-1'}`}>{children}</div>}
    </div>
  );
}
