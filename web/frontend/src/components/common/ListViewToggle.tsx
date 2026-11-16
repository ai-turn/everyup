import { useContext } from 'react';
import { ControlDefaultsContext } from './controlSize';
import { SegmentedControl } from './SegmentedControl';

export type ListView = 'grid' | 'card';

export function ListViewToggle({ view, onChange, size }: { view: ListView; onChange: (view: ListView) => void; size?: 'sm' | 'md' }) {
  const defaults = useContext(ControlDefaultsContext);
  size ??= defaults.size ?? 'md';
  return <div className="ml-auto shrink-0"><SegmentedControl ariaLabel="대상 보기 방식" size={size} value={view} onChange={onChange}
    options={[{ value: 'grid', label: '그리드', icon: 'view_list' }, { value: 'card', label: '카드', icon: 'grid_view' }]} /></div>;
}
