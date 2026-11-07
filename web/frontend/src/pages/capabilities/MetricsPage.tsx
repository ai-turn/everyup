import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ListToolbar, ListViewToggle, MaterialIcon, PageHeader, SearchInput, Select } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import { MetricServices } from '../../features/metrics/MetricServices';
import { useMetricServices } from '../../features/metrics/useMetricServices';
import { flaggedMetrics, metricCollection } from '../../features/metrics/metricPresentation';

const METRIC_SKELETONS = ['metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'];

export function MetricsPage() {
  const { view, setView, returnTo } = useListView();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const search = query.trim().toLowerCase();
  const { rows, checkedAt: now, loading, error, reload } = useMetricServices();
  const sort = params.get('sort') === 'name' ? 'name' : 'collection';
  // 확인할 지표가 많은 서비스 → 수집 이상 → 수신 대기·중지 → 정상
  const priority = (row: typeof rows[number]) => {
    const tone = metricCollection(row.active, row.lastReceivedAt, row.lastMetricAt, now).tone;
    return [-flaggedMetrics(row.active, row.metrics, now).length, tone === 'warn' ? 0 : tone === 'idle' ? 1 : 2];
  };
  const byPriority = (a: typeof rows[number], b: typeof rows[number]) => {
    const [pa, pb] = [priority(a), priority(b)];
    return pa[0] - pb[0] || pa[1] - pb[1];
  };
  const filtered = rows.filter(row => row.name.toLowerCase().includes(search) || row.metricNames.some(name => name.toLowerCase().includes(search)))
    .sort((a, b) => (sort === 'collection' ? byPriority(a, b) : 0) || a.name.localeCompare(b.name));
  const setQuery = (value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    if (value) next.set('q', value); else next.delete('q');
    return next;
  }, { replace: true });

  return <div>
    <PageHeader title="메트릭" subtitle="OpenTelemetry로 직접 연결한 앱의 성능 수치와 시간에 따른 변화를 확인합니다.">
      <MonitoringConnection capability="metrics" onConnected={reload} />
    </PageHeader>
    <DockerEnvironmentHint className="mb-5" />
    <ListToolbar search={<SearchInput value={query} onChange={event => setQuery(event.target.value)} placeholder="서비스 또는 메트릭 이름으로 찾기" aria-label="서비스 또는 메트릭 이름으로 찾기" />}>
      <Button collapseLabel variant="secondary" onClick={reload} disabled={loading}><MaterialIcon name="refresh" />새로고침</Button>
      <Select aria-label="서비스 정렬" wrapperClassName="w-40" value={sort} onChange={event => setParams(current => { const next = new URLSearchParams(current); next.set('sort', event.target.value); return next; }, { replace: true })}>
        <option value="collection">확인 필요순</option><option value="name">이름순</option>
      </Select>
      <div className="sm:ml-auto"><ListViewToggle view={view} onChange={setView} /></div>
    </ListToolbar>
    {loading ? <div aria-label="메트릭 서비스 조회 중" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {METRIC_SKELETONS.map(item => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
    </div> : error ? <EmptyState icon="error_outline" title="메트릭을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
      : rows.length === 0 ? <EmptyState icon="monitoring" title="아직 연결된 메트릭 서비스가 없습니다" description="앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
        <MonitoringConnection capability="metrics" onConnected={reload} />
      </EmptyState> : <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-section-title text-text-base">메트릭 서비스</h2>
          <span role="status" className="text-xs text-text-dim">{search ? `서비스 ${filtered.length} / ${rows.length}개` : `서비스 ${rows.length}개`}</span>
        </div>
        {filtered.length ? <MetricServices rows={filtered} now={now} view={view} returnTo={returnTo} query={search} />
          : <EmptyState icon="search" title="일치하는 서비스가 없습니다" description={`'${query.trim()}'와 일치하는 서비스나 메트릭 이름이 없습니다.`} action={{ label: '검색 초기화', onClick: () => setQuery('') }} />}
      </section>}
  </div>;
}
