import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ListViewToggle, PageHeader, RefreshIconButton } from '../../components/common';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useListView } from '../../hooks/useListView';
import { LogServiceOverview } from '../../features/logs/components/LogServiceOverview';
import { logScopeKey, withLogSummaries, type LogPatternRow, type LogServiceRow } from '../../features/logs/logServiceRows';
import { appPath, DOCKER_SERVERS_PATH, SERVERS_PATH } from '../../features/servers/serverPaths';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

/**
 * 전체 로그: 여러 서버를 가로지르는 로그 요약과 반복 패턴(설계 6.6). 장애가 어느 서버에서 났는지 모를 때 본다.
 * 서버에 속한 앱(직접 연결)만 나온다. Docker Collector의 로그는 Docker 환경에 있다(ADR 0011).
 */
export function LogsPage() {
  useBreadcrumb([{ label: '전체 로그' }]);
  const { view, setView, returnTo } = useListView();
  const [rows, setRows] = useState<LogServiceRow[]>([]);
  const [patterns, setPatterns] = useState<LogPatternRow[] | null>([]);
  const [span, setSpan] = useState<[number, number]>([0, 0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasDockerEnvironments, setHasDockerEnvironments] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([
      // 패턴과 서버 이름은 보조 정보라, 실패해도 앱 목록은 그린다. 행의 링크는 앱의 serverId로 만든다.
      api.getObservedServices('logs'), api.getServers({ includeDocker: true }).catch(() => null), api.getLogSummary(), api.getLogPatterns().catch(() => null),
      api.getAgents().catch(() => null),
    ])
      .then(([apps, servers, summaries, patternRows, agents]) => {
        if (!alive) return;
        setHasDockerEnvironments((agents ?? []).length > 0);
        const serverNames = new Map((servers ?? []).map(server => [server.id, server.name]));
        // 서버가 없는 앱은 열 화면이 없다. 백엔드는 모든 직접 연결 앱을 서버에 묶는다(설계 5.3).
        const base: LogServiceRow[] = (apps ?? []).flatMap(app => app.serverId ? [{
          key: logScopeKey({ serviceId: app.id }),
          name: app.name,
          subtitle: serverNames.get(app.serverId),
          serverName: serverNames.get(app.serverId),
          stopped: !app.isActive,
          to: `${appPath(app.serverId, app.id, 'logs')}&range=24h`,
        }] : []);
        const next = withLogSummaries(base, summaries ?? [], patternRows ?? []);
        setError(null);
        setSpan(next.span);
        setRows(next.rows);
        setPatterns(patternRows === null ? null : next.patterns);
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div>
      {/* 사이드바에 없는 화면이라 제목을 숨기지 않는다. 로그 연결은 서버의 로그 탭에서 한다. */}
      <PageHeader compactActions title="전체 로그">
        <RefreshIconButton onClick={reload} refreshing={loading} />
      </PageHeader>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-48 animate-pulse rounded-xl bg-ui-hover-soft" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="로그를 불러오지 못했습니다" description={error} headingLevel="h2" action={{ label: '다시 시도', onClick: reload }} />
      ) : rows.length === 0 ? (
        <EmptyState icon="article" title="로그를 보내는 앱이 없습니다" description="서버 화면의 로그 탭에서 앱을 OpenTelemetry로 연결하면 여기에 모입니다." headingLevel="h2"
          action={{ label: '서버 목록', to: SERVERS_PATH }} />
      ) : (
        <>
          <LogServiceOverview rows={rows} patterns={patterns} span={span} view={view} returnTo={returnTo} title="앱" noun="앱" onRetryPatterns={reload}
            viewToggle={<ListViewToggle view={view} onChange={setView} />} />
          {/* 이 화면은 직접 연결한 앱만 모은다. Docker Collector의 로그를 여기서 찾는 사용자에게 자리를 알린다. */}
          {hasDockerEnvironments && (
            <p className="mt-8 type-body text-text-muted">
              Docker 서비스의 로그는 Docker 환경에 있습니다. <Link to={DOCKER_SERVERS_PATH} className="text-action link-underline">Docker 환경</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
