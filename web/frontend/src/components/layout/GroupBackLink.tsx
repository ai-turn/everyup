import { Link } from 'react-router-dom';
import { MaterialIcon } from '../common';
import { useGroupTrail } from '../../hooks/useGroupTrail';

// 모바일에는 breadcrumb이 없고 하단 내비의 "그룹"은 그룹 목록으로 간다.
// 그룹에서 연 대상 화면에서는 그 그룹으로 바로 돌아가는 링크를 둔다. 데스크톱은 breadcrumb이 맡는다.
export function GroupBackLink() {
  const trail = useGroupTrail();
  if (!trail) return null;
  return (
    <Link to={`/projects/${trail.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-text-muted transition-colors hover:text-action lg:hidden">
      <MaterialIcon size={20} name="arrow_back" />{trail.name}
    </Link>
  );
}
