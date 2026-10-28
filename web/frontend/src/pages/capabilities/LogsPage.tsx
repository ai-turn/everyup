import { useEffect, useState } from 'react';
import { EmptyState, ListViewToggle, PageHeader } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { LogServiceOverview } from '../../features/logs/components/LogServiceOverview';
import { logScopeKey, withLogSummaries, type LogPatternRow, type LogServiceRow } from '../../features/logs/logServiceRows';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

export function LogsPage() {
  const { view, setView, returnTo } = useListView();
  const [rows, setRows] = useState<LogServiceRow[]>([]);
  const [patterns, setPatterns] = useState<LogPatternRow[] | null>([]);
  const [span, setSpan] = useState<[number, number]>([0, 0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([
      // 패턴은 보조 정보라, 실패해도 서비스 목록은 그린다.
      api.getObservedServices('logs'), api.getLogSummary(), api.getLogPatterns().catch(() => null),
    ])
      .then(([directServices, summaries, patternRows]) => {
        if (!alive) return;
        const base: LogServiceRow[] = (directServices ?? []).map(service => ({
          key: logScopeKey({ serviceId: service.id }),
          name: service.name,
          stopped: !service.isActive,
          to: `/logs/${service.id}?range=24h`,
        }));
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
      <PageHeader title="로그" subtitle="서비스별 최근 오류·경고 건수를 보고, 서비스를 열어 로그를 검색합니다.">
        <MonitoringConnection capability="logs" onConnected={reload} />
      </PageHeader>
      <div className="mb-5 flex"><ListViewToggle view={view} onChange={setView} /></div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-48 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="로그를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
      ) : rows.length === 0 ? (
        <EmptyState icon="article" title="아직 로그 서비스가 없습니다" description="앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <div className="flex flex-col items-center gap-4">
            <MonitoringConnection capability="logs" onConnected={reload} />
            <DockerEnvironmentHint />
          </div>
        </EmptyState>
      ) : (
        <LogServiceOverview rows={rows} patterns={patterns} span={span} view={view} returnTo={returnTo} />
      )}
    </div>
  );
}
