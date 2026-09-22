import type { CSSProperties } from 'react';
import { iconMarkup } from './materialIconPaths';

interface MaterialIconProps {
  name: string;
  size?: 16 | 20 | 24 | 32 | 36 | 48;
  className?: string;
  style?: CSSProperties;
}

export function MaterialIcon({ name, size = 20, className = '', style }: MaterialIconProps) {
  // Static markup generated from @mui/icons-material at build time — safe to inject.
  const markup = iconMarkup[name] ?? iconMarkup.help_outline;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center align-middle leading-none ${className}`.trim()}
      style={style}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        focusable="false"
        width={size}
        height={size}
        className="shrink-0"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </span>
  );
}
