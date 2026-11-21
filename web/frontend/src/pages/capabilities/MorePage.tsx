import { Link } from 'react-router-dom';
import { MaterialIcon, PageHeader } from '../../components/common';
import { NAV_SECTIONS } from '../../components/layout/navSections';
import { ALL_LOGS_PATH } from '../../features/servers/serverPaths';

// 모바일 셸(Header + BottomNavMobile)에서 사이드바를 대신한다 — 하단 내비에 없는 섹션은 전부 여기 나온다.
// 전체 로그는 사이드바에 없는 서버 섹션의 화면이라(설계 6.6) 모바일에서는 여기서 들어간다.
const LINKS = [
  { to: ALL_LOGS_PATH, label: '전체 로그', icon: 'article', description: '모든 서버의 로그 요약과 패턴을 봅니다.' },
  ...NAV_SECTIONS.filter((section) => section.mobile === 'more'),
];

export function MorePage() {

  return (
    <div>
      <PageHeader title="더보기" />
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {LINKS.map((link) => <Link key={link.to} to={link.to} className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-ui-hover-soft">
          <MaterialIcon size={20} name={link.icon} className="text-action" />
          <div className="min-w-0"><h2 className="type-card-title text-text-base">{link.label}</h2><p className="mt-intra type-body text-text-muted">{link.description}</p></div>
          <MaterialIcon size={20} name="chevron_right" className="ml-auto text-text-dim" />
        </Link>)}
      </div>
    </div>
  );
}
