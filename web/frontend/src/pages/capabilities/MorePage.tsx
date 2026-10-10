import { Link } from 'react-router-dom';
import { MaterialIcon, PageHeader } from '../../components/common';
import { NAV_SECTIONS } from '../../components/layout/navSections';

// 모바일 셸(Header + BottomNavMobile)에서 사이드바를 대신한다 — 하단 내비에 없는 섹션은 전부 여기 나온다.
const LINKS = NAV_SECTIONS.filter((section) => section.mobile === 'more');

export function MorePage() {

  return (
    <div>
      <PageHeader title="더보기" subtitle="추가 모니터링 기능과 설정으로 이동합니다." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LINKS.map((link) => <Link key={link.to} to={link.to} className="card-interactive flex items-center gap-3 rounded-xl border border-ui-border bg-bg-surface p-4">
          <MaterialIcon size={20} name={link.icon} className="text-action" />
          <div className="min-w-0"><h2 className="type-card-title text-text-base">{link.label}</h2><p className="mt-0.5 type-body text-text-muted">{link.description}</p></div>
          <MaterialIcon size={20} name="chevron_right" className="ml-auto text-text-dim" />
        </Link>)}
      </div>
    </div>
  );
}
