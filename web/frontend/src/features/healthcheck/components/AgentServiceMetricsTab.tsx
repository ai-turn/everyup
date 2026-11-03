import { useEffect, useState } from 'react';
import { Button, EmptyState, MaterialIcon, SearchInput, type GlobalTimeRange } from '../../../components/common';
import { Skeleton } from '../../../components/skeleton';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { api, type OtelMetricName } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { MetricChart, type MetricSource } from '../../metrics/MetricChart';
import { useMetricQuery, useMetricWindow } from '../../metrics/useMetricQuery';

const SEARCH_MIN_METRICS = 8;

interface CommonProps {
  refreshKey?: number;
  range: GlobalTimeRange;
}
interface AgentProps extends CommonProps {
  agentId: string;
  serviceKey: string;
}
interface DirectProps extends CommonProps {
  observedServiceId: string;
}

/**
 * A grid of panels sharing a crosshair, loaded twelve at a time. A panel's
 * title opens that metric alone (`?metric=`), so
 * the browser's back button returns to the grid.
 */
function ServiceMetricsPanel({ source, refreshKey, range }: CommonProps & { source: MetricSource }) {
  const [names, setNames] = useState<OtelMetricName[]>([]);
  const [namesLoading, setNamesLoading] = useState(true);
  const [namesError, setNamesError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { search: query, metric, update } = useMetricQuery();
  const window = useMetricWindow(range, refreshKey);
  // Panels share a crosshair (syncId); only the hovered one shows its tooltip box.
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [hovered, setHovered] = useState<string | null>(null);

  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    // A refresh can overlap the previous read; only the newest may land.
    let cancelled = false;
    const loadNames = async () => {
      setNamesLoading(true);
      setNamesError(null);
      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricNames(agentId, serviceKey)
          : await api.getObservedServiceOtelMetricNames(observedServiceId);
        // The API orders by last received, which reshuffles the grid on every
        // refresh. By name it stays put and prefixes (http.*, jvm.*) group.
        if (!cancelled) setNames([...loaded].sort((a, b) => a.metricName.localeCompare(b.metricName)));
      } catch (error) {
        if (!cancelled) setNamesError(getErrorMessage(error));
      } finally {
        if (!cancelled) setNamesLoading(false);
      }
    };
    void loadNames();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, refreshKey, retryKey]);

  // One rules read for every panel; each panel takes the rules for its metric.
  const rules = useAlertThresholds(
    source.kind === 'direct' ? { kind: 'direct', serviceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey },
    'otel_metric',
  );
  const rulesFor = (name: string) => rules.filter(rule => rule.metricName === name);

  const openMetric = (name: string) => update({ metric: name, metricAttributes: null, metricSeries: null, metricMode: null });
  // Returning to the grid replaces the selected view instead of reopening it on Back.
  const closeMetric = () => update({ metric: null, metricAttributes: null, metricSeries: null, metricMode: null }, true);

  if (namesLoading && names.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-80 w-full rounded-xl" />)}
      </div>
    );
  }
  if (namesError && names.length === 0) {
    return <EmptyState icon="error_outline" title="메트릭 목록을 불러오지 못했습니다" description={namesError} action={{ label: '다시 시도', onClick: () => setRetryKey(key => key + 1) }} />;
  }
  if (names.length === 0) {
    return (
      <div className="rounded-xl border border-ui-border bg-bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">수신한 메트릭이 없습니다. OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다.</p>
      </div>
    );
  }

  const opened = names.find(item => item.metricName === metric);
  const warning = namesError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3">
    <p className="type-body text-text-muted">메트릭 목록을 새로고침하지 못했습니다. 이전 목록을 표시합니다.</p>
    <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>목록 다시 시도</Button>
  </div>;
  if (metric !== null && !opened) {
    return <>{warning}<EmptyState icon="search" title="메트릭을 찾을 수 없습니다" description="선택한 메트릭이 이 서비스의 저장된 목록에 없습니다." action={{ label: '전체 메트릭', onClick: closeMetric }} /></>;
  }
  if (opened) {
    return (
      <div className="space-y-3">
        {warning}
        <Button variant="ghost" size="sm" onClick={closeMetric}><MaterialIcon name="arrow_back" />전체 메트릭</Button>
        <MetricChart
          key={`${opened.metricName}:${opened.metricType}:${opened.unit ?? ''}`}
          source={source}
          meta={opened}
          window={window}
          refreshKey={refreshKey}
          rules={rulesFor(opened.metricName)}
          expanded
          showTooltip
        />
      </div>
    );
  }

  const visible = names.filter(item => item.metricName.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div>
      {(names.length > SEARCH_MIN_METRICS || query) && (
        <SearchInput
          value={query}
          onChange={event => update({ metricSearch: event.target.value }, true)}
          placeholder="메트릭 이름으로 찾기"
          aria-label="메트릭 이름으로 찾기"
          wrapperClassName="mb-4 sm:w-72"
        />
      )}
      {warning}
      {visible.length === 0 ? (
        <EmptyState icon="search" title="일치하는 메트릭이 없습니다" description={`'${query.trim()}'와 일치하는 메트릭 이름이 없습니다.`} action={{ label: '검색 초기화', onClick: () => update({ metricSearch: null }, true) }} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.slice(0, visibleLimit).map(meta => (
            <MetricChart
              key={`${meta.metricName}:${meta.metricType}:${meta.unit ?? ''}`}
              source={source}
              meta={meta}
              window={window}
              refreshKey={refreshKey}
              rules={rulesFor(meta.metricName)}
              onExpand={() => openMetric(meta.metricName)}
              showTooltip={hovered === meta.metricName}
              onHover={setHovered}
            />
          ))}
        </div>
      )}
      {visible.length > visibleLimit && <div className="mt-4 flex flex-wrap items-center gap-3"><p className="type-body text-text-muted">{`${visible.length}개 중 ${visibleLimit}개 메트릭 표시`}</p><Button variant="secondary" onClick={() => setVisibleLimit(value => value + 12)}>메트릭 12개 더 보기</Button></div>}
    </div>
  );
}

export function AgentServiceMetricsTab({ agentId, serviceKey, ...common }: AgentProps) {
  return <ServiceMetricsPanel key={`${agentId}:${serviceKey}`} {...common} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceMetricsTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceMetricsPanel key={observedServiceId} {...common} source={{ kind: 'direct', observedServiceId }} />;
}
