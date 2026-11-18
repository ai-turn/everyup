import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/common';

/**
 * 서버 탭에서 대상 상세(모니터, 로그 앱)가 탭의 목록으로 돌아가는 링크. 크럼이 탭을 말하지 않으므로(탭은 위치가 아니다)
 * 모든 폭에서 보인다. 모양은 옛 상세의 모바일 복귀 링크와 같고, 데스크톱에서는 높이만 줄인다.
 */
export function TabBackLink({ label, to }: { label: string; to: string }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1 text-sm text-text-muted transition-colors hover:text-action lg:min-h-6">
      <MaterialIcon size={20} name="arrow_back" />{label}
    </Link>
  );
}
