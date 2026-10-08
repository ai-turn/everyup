import { Link } from 'react-router-dom';
import { MaterialIcon, PageHeader } from '../../components/common';

const LINKS = [
  { to: '/environments', icon: 'dns', title: 'Docker 환경', description: 'Collector 연결과 발견된 서비스를 관리합니다.' },
  { to: '/api', icon: 'api', title: 'API 요청', description: '요청 상태와 오류를 확인합니다.' },
  { to: '/metrics', icon: 'monitoring', title: '메트릭', description: 'OpenTelemetry 메트릭을 확인합니다.' },
  { to: '/settings', icon: 'settings', title: '설정', description: 'EveryUp 환경을 설정합니다.' },
] as const;

export function MorePage() {

  return (
    <div>
      <PageHeader title="더보기" subtitle="추가 모니터링 기능과 설정으로 이동합니다." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LINKS.map((link) => <Link key={link.to} to={link.to} className="card-interactive flex items-center gap-3 rounded-xl border border-ui-border bg-bg-surface p-4">
          <MaterialIcon size={20} name={link.icon} className="text-action" />
          <div className="min-w-0"><h2 className="type-card-title text-text-base">{link.title}</h2><p className="text-sm text-text-muted">{link.description}</p></div>
          <MaterialIcon size={20} name="chevron_right" className="ml-auto text-text-dim" />
        </Link>)}
      </div>
    </div>
  );
}
