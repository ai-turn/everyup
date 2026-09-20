interface ConnectionSourceBadgeProps {
  source: 'direct' | 'docker';
  directLabel?: string;
}

export function ConnectionSourceBadge({
  source,
  directLabel = '직접 연결',
}: ConnectionSourceBadgeProps) {
  return (
    <span
      className={`badge ${
        source === 'direct'
          ? 'border-primary/20 bg-primary/10 text-primary'
          : 'border-ui-border bg-ui-hover text-text-secondary'
      }`}
    >
      {source === 'direct' ? directLabel : 'Docker'}
    </span>
  );
}
