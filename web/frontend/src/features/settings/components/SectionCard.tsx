export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // 파괴적 작업도 카드는 중립 — 색은 액션 텍스트에만 싣는다.
  return (
    <div className="bg-bg-surface border border-ui-border rounded-xl p-4">
      <div className="mb-4">
        <h2 className="type-card-title text-text-base">{title}</h2>
        {subtitle && (
          <p className="type-body text-text-muted mt-1">{subtitle}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
