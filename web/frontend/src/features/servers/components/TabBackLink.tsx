import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/common';

/**
 * 서버 탭에서 대상 상세(모니터, 로그 앱)가 탭의 목록으로 돌아가는 링크. 크럼이 탭을 말하지 않으므로(탭은 위치가 아니다)
 * 모든 폭에서 보인다. 탭 줄의 조작 자리(TabAction)에서 추가 버튼 앞에 둔다. 패널 위에 따로 한 줄을 두면 모바일에서
 * 탭 → 조작 줄 → 링크 줄 → 제목으로 첫 내용이 152px 아래였다(DESIGN.md §4.6 서버 탭). 모바일에서는 조작 줄의 왼쪽 끝이다.
 */
export function TabBackLink({ label, to }: { label: string; to: string }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1 text-sm text-text-muted transition-colors hover:text-action max-sm:mr-auto lg:min-h-6">
      <MaterialIcon size={20} name="arrow_back" />{label}
    </Link>
  );
}
