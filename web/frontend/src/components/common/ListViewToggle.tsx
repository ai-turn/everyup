import { SegmentedControl } from './SegmentedControl';

export type ListView = 'grid' | 'card';

// 크기는 SegmentedControl이 자리로 정한다: AppHeader 안은 32px, 본문은 같은 행의 Button md와 같은 40px(모바일 44px).
export function ListViewToggle({ view, onChange }: { view: ListView; onChange: (view: ListView) => void }) {
  return <div className="ml-auto shrink-0"><SegmentedControl ariaLabel="대상 보기 방식" value={view} onChange={onChange}
    options={[{ value: 'grid', label: '그리드', icon: 'view_list' }, { value: 'card', label: '카드', icon: 'grid_view' }]} /></div>;
}
