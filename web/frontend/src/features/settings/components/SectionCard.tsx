import { SectionHeader } from '../../../components/common';

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // 섹션은 카드로 감싸지 않고 제목과 간격으로 나눈다(DESIGN.md §3.1). 파괴적 작업도 색은 액션 텍스트에만 싣는다.
  return (
    <div>
      <SectionHeader title={title} description={subtitle} className="mb-4" />
      <div>{children}</div>
    </div>
  );
}
