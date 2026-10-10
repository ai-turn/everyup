import { Link } from 'react-router-dom';
import { MaterialIcon, PageHeader } from '../../components/common';

// 모바일 셸(Header + BottomNavMobile)에서 사이드바를 대신한다 — 하단 내비에 없는 섹션은 전부 여기 있어야 한다.
// 순서·아이콘·라벨은 사이드바와 같게(navSections.ts가 사이드바 표기를 정본으로 삼는다).
const LINKS = [
  { to: '/environments', icon: 'dns', title: 'Docker 환경', description: 'Collector 연결과 발견된 서비스를 관리합니다.' },
  { to: '/uptime', icon: 'monitor_heart', title: '업타임', description: '서비스 응답과 장애 대상을 확인합니다.' },
  { to: '/logs', icon: 'article', title: '로그', description: '서비스별 오류·경고를 보고 로그를 검색합니다.' },
  { to: '/infrastructure', icon: 'memory', title: '인프라', description: '서버의 CPU, 메모리, 디스크 상태를 확인합니다.' },
  { to: '/api', icon: 'api', title: 'API 요청', description: '요청 상태와 오류를 확인합니다.' },
  { to: '/metrics', icon: 'monitoring', title: '메트릭', description: 'OpenTelemetry 메트릭을 확인합니다.' },
  { to: '/settings', icon: 'settings', title: '환경 설정', description: 'EveryUp 환경을 설정합니다.' },
] as const;

export function MorePage() {

  return (
    <div>
      <PageHeader title="더보기" subtitle="추가 모니터링 기능과 설정으로 이동합니다." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LINKS.map((link) => <Link key={link.to} to={link.to} className="card-interactive flex items-center gap-3 rounded-xl border border-ui-border bg-bg-surface p-4">
          <MaterialIcon size={20} name={link.icon} className="text-action" />
          <div className="min-w-0"><h2 className="type-card-title text-text-base">{link.title}</h2><p className="mt-0.5 type-body text-text-muted">{link.description}</p></div>
          <MaterialIcon size={20} name="chevron_right" className="ml-auto text-text-dim" />
        </Link>)}
      </div>
    </div>
  );
}
