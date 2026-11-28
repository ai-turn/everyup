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
    <div className="flex flex-col gap-label py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-group">
      <div className="min-w-0 flex-1">
        <p className="type-label text-text">{label}</p>
        {/* 라벨 → 설명 4px, 모바일에서 설명 → 조작 8px(DESIGN.md §6 폼 리듬) */}
        {description && <p data-gap="intra" className="mt-intra type-body text-text-muted">{description}</p>}
      </div>
      <div className="max-w-full shrink-0 self-start sm:self-center">{children}</div>
    </div>
  );
}
