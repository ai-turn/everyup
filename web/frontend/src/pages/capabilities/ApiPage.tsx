import { useState } from 'react';
import { Button, EmptyState, ListViewToggle, MaterialIcon, PageHeader, TimeRangePicker } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import { ApiTargets } from '../../features/api-requests/ApiTargets';
import { useApiTargets } from '../../features/api-requests/useApiTargets';
import { useRequestQuery, useRequestWindow } from '../../features/api-requests/useRequestQuery';

export function ApiPage() {
  const { view, setView, returnTo } = useListView();
  const { range, update } = useRequestQuery();
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey(key => key + 1);
  const window = useRequestWindow(range, refreshKey);
  const { rows, loading, error, retryTarget } = useApiTargets(window, refreshKey);
  return <div>
    <PageHeader title="API 요청" subtitle="수집된 HTTP 요청과 오류를 비교하고 조사할 서비스를 선택합니다.">
      <MonitoringConnection capability="api" onConnected={reload} />
    </PageHeader>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <TimeRangePicker value={range} onChange={value => update({ range: value })} />
        <Button variant="secondary" onClick={reload}><MaterialIcon name="refresh" />새로고침</Button>
      </div>
      <ListViewToggle view={view} onChange={setView} />
    </div>
    <p className="mb-3 type-caption text-text-muted">최근 {Number.parseInt(range)}시간의 수집 요청</p>
    {loading ? <div aria-label="API 대상 조회 중" className="h-40 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      : error ? <EmptyState icon="error_outline" title="API 데이터를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
        : rows.length === 0 ? <EmptyState icon="api" title="표시할 API 대상이 없습니다" description="앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <div className="flex flex-col items-center gap-4"><MonitoringConnection capability="api" onConnected={reload} /><DockerEnvironmentHint /></div>
        </EmptyState> : <ApiTargets rows={rows} view={view} range={range} returnTo={returnTo} onRetry={retryTarget} />}
  </div>;
}
