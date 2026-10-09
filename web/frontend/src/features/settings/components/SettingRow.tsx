export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-ui-border-soft py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="type-label text-text-secondary">{label}</p>
        {description && <p className="mt-0.5 type-body text-text-muted">{description}</p>}
      </div>
      <div className="max-w-full shrink-0 self-start sm:self-center">{children}</div>
    </div>
  );
}
