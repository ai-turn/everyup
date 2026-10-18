import { SegmentedControl } from './SegmentedControl';

export type ListView = 'grid' | 'card';

export function ListViewToggle({ view, onChange }: { view: ListView; onChange: (view: ListView) => void }) {
  return <div className="ml-auto"><SegmentedControl ariaLabel="대상 보기 방식" size="md" value={view} onChange={onChange}
    options={[{ value: 'grid', label: '그리드' }, { value: 'card', label: '카드' }]} /></div>;
}
