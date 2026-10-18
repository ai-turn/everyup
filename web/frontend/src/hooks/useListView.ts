import { useLocation, useSearchParams } from 'react-router-dom';
import type { ListView } from '../components/common/ListViewToggle';

export function useListView() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const view: ListView = params.get('view') === 'card' ? 'card' : 'grid';
  const setView = (value: ListView) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value === 'card') next.set('view', value); else next.delete('view');
    return next;
  }, { replace: true });
  return { view, setView, returnTo: `${location.pathname}${location.search}` };
}
