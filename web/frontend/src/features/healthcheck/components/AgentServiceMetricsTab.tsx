import { useState, type ReactNode } from 'react';
import { Button, ButtonLink, EmptyState, MaterialIcon, SearchInput, StatusLight, type GlobalTimeRange } from '../../../components/common';
import { alertRuleNewPath, type AlertTarget } from '../../alerts/alertTarget';
import { Skeleton } from '../../../components/skeleton';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import type { OtelMetricName } from '../../../services/api';
import { MetricChart, type MetricSource } from '../../metrics/MetricChart';
import { useMetricQuery, useMetricWindow } from '../../metrics/useMetricQuery';
import { metricFlags, metricGroup, metricHealthCollection, metricIdentity, metricTitle } from '../../metrics/metricPresentation';
import { useMetricHealth, type MetricHealthState } from '../../metrics/useMetricHealth';

interface CommonProps { refreshKey?: number; range: GlobalTimeRange; active?: boolean }
interface AgentProps extends CommonProps { agentId: string; serviceKey: string }
interface DirectProps extends CommonProps {
  observedServiceId: string;
  /** 페이지가 헤더 수집 상태에 같은 응답을 쓰도록 health를 위에서 받는다. */
  state: MetricHealthState;
  /** 한 번도 받지 않았을 때의 본문(수신 대기 안내). 없으면 기본 문구. */
  empty?: ReactNode;
}

const GROUPS = ['고정한 지표', '요청과 응답', '작업과 메시지', '런타임과 리소스', '사용자 정의 지표'];

function ServiceMetricsPanel({ source, state, refreshKey, range, active = true, empty, showCollection }: CommonProps & { source: MetricSource; state: MetricHealthState; empty?: ReactNode; showCollection: boolean }) {
  const { health, loading, error, retry } = state;
  const query = useMetricQuery();
  const window = useMetricWindow(range, refreshKey);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [hovered, setHovered] = useState<string | null>(null);
  const sourceKey = JSON.stringify(source);
  const storageKey = `everyup:metric-pins:${sourceKey}`;
  const [pins, setPins] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 4) : [];
    } catch { return []; }
  });
  const togglePin = (meta: OtelMetricName) => {
    const id = metricIdentity(meta);
    const next = pins.includes(id) ? pins.filter(pin => pin !== id) : [...pins, id].slice(0, 4);
    setPins(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session preferences still work without storage. */ }
  };

  const alertTarget: AlertTarget = source.kind === 'direct' ? { kind: 'direct', serviceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey };
  const rules = useAlertThresholds(alertTarget, 'otel_metric');
  const openMetric = (meta: OtelMetricName) => query.update({ metric: meta.metricName, metricType: meta.metricType, metricUnit: meta.unit || null, metricAttributes: null, metricSeries: null, metricMode: null });
  const closeMetric = () => query.update({ metric: null, metricType: null, metricUnit: null, metricAttributes: null, metricSeries: null, metricMode: null }, true);
  if (!health) return loading
    ? <div aria-label="메트릭 상태 조회 중" className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-80 w-full rounded-xl" />)}</div>
    : <EmptyState icon="error_outline" title="메트릭 목록을 불러오지 못했습니다" description={error ?? undefined} action={{ label: '다시 시도', onClick: retry }} />;

  // 섹션 순서 → 이름순으로 정렬한 뒤 12개로 자른다. 이름순으로 먼저 자르면 앞 섹션이 뒤 섹션 이름에 밀려 빠진다.
  const names = [...health.metrics].sort((a, b) => GROUPS.indexOf(metricGroup(a)) - GROUPS.indexOf(metricGroup(b)) || a.metricName.localeCompare(b.metricName) || metricIdentity(a).localeCompare(metricIdentity(b)));
  const { now, receivedAt, collection } = metricHealthCollection(health, active);
  // 앱이 만드는 링크는 단위가 있으면 항상 넣는다. 단위가 없는 링크는 단위 없는 지표를 먼저 고르고,
  // 그런 지표가 없으면(손으로 쓴 링크) 단위를 비교하지 않는다.
  const candidates = names.filter(item => item.metricName === query.metric && (!query.metricType || item.metricType === query.metricType));
  const unitless = candidates.filter(item => !item.unit);
  const matches = query.metricUnit !== null ? candidates.filter(item => (item.unit ?? '') === query.metricUnit)
    : query.metricType && candidates.length > 1 && unitless.length > 0 ? unitless : candidates;
  const opened = matches.length === 1 ? matches[0] : null;
  const flagged = names.filter(item => metricFlags(item, now).length > 0);
  const search = query.search.trim().toLowerCase();
  const visible = names.filter(item => `${item.metricName} ${metricTitle(item)} ${item.description ?? ''}`.toLowerCase().includes(search));
  const groupFor = (meta: OtelMetricName) => pins.includes(metricIdentity(meta)) ? '고정한 지표' : metricGroup(meta);
  const displayed = [...visible.filter(item => pins.includes(metricIdentity(item))), ...visible.slice(0, visibleLimit).filter(item => !pins.includes(metricIdentity(item)))];
  const chart = (meta: OtelMetricName, expanded = false) => <MetricChart key={metricIdentity(meta)} source={source} meta={meta} window={window} refreshKey={refreshKey}
    rules={meta.conflicting ? [] : rules.filter(rule => rule.metricName === meta.metricName)} expanded={expanded} onExpand={() => openMetric(meta)} showTooltip={expanded || hovered === metricIdentity(meta)} onHover={setHovered}
    pinned={pins.includes(metricIdentity(meta))} onPin={() => togglePin(meta)} pinDisabled={!pins.includes(metricIdentity(meta)) && pins.length >= 4} />;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 type-caption text-text-muted" aria-label="메트릭 수집 현황">
      {/* 직접 상세는 헤더가 같은 판정으로 수집 상태와 마지막 수신을 보인다. */}
      {showCollection && <StatusLight {...collection} />}<span>{names.length}개 지표</span>
      {showCollection && <span>마지막 수신 {receivedAt ? <time dateTime={receivedAt}>{new Date(receivedAt).toLocaleString('ko-KR', { hour12: false })}</time> : '기록 없음'}</span>}
      {loading && <span role="status">상태 갱신 중…</span>}
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3"><p className="type-body text-status-warn">메트릭 상태를 새로고침하지 못했습니다. 이전 상태를 표시합니다.</p><Button variant="secondary" size="sm" onClick={retry}>목록 다시 시도</Button></div>}
    {query.metric !== null ? <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={closeMetric}><MaterialIcon name="arrow_back" />전체 메트릭</Button>
        {/* 이 메트릭과 대상을 채운 규칙 폼을 연다. 임계값은 비워 두고 사용자가 정한다. */}
        {opened && <ButtonLink variant="secondary" size="sm" to={alertRuleNewPath(alertTarget, { category: 'metric', metricName: opened.metricName })}><MaterialIcon name="notifications" />알림 추가</ButtonLink>}
      </div>
      {opened ? chart(opened, true) : matches.length > 1 ? <div className="space-y-3"><p className="type-body text-text-muted">같은 이름의 타입·단위가 여러 개입니다. 조회할 지표를 선택해 주세요.</p>{matches.map(meta => <Button key={metricIdentity(meta)} variant="secondary" onClick={() => openMetric(meta)} className="h-auto min-h-11 flex-wrap gap-x-3 py-2"><span className="min-w-0 break-all">{meta.metricName}</span><span>{meta.metricType}</span><span>{meta.unit || '단위 없음'}</span></Button>)}</div>
        : <EmptyState icon="search" title="메트릭을 찾을 수 없습니다" description="선택한 메트릭이 이 서비스의 저장된 목록에 없습니다." action={{ label: '전체 메트릭', onClick: closeMetric }} />}
    </> : <>
      {flagged.length > 0 && <details className="rounded-lg border border-ui-border bg-bg-surface p-4" open>
        <summary className="cursor-pointer type-label text-text-base">확인 필요 · {flagged.length}개 지표</summary>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 type-caption text-text-muted">
          <span>전체 지표 기준</span>
          <span>최근 5분 원값 임계값과 수신 상태로 판단</span>
          <span>{new Date(health.checkedAt).toLocaleTimeString('ko-KR', { hour12: false })} 확인</span>
        </div>
        <div className="mt-3 max-h-48 divide-y divide-ui-border-soft overflow-y-auto" aria-label="확인이 필요한 메트릭">
          {flagged.map(meta => <button key={metricIdentity(meta)} type="button" onClick={() => openMetric(meta)} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-left hover:text-action">
            <span className="min-w-0 break-all type-body">{metricTitle(meta)}<span className="ml-2 type-caption text-text-muted">{meta.metricType} · {meta.unit || '단위 없음'}</span></span>
            <span className="flex flex-wrap gap-3">{metricFlags(meta, now).map(flag => <StatusLight key={flag.label} {...flag} />)}</span>
          </button>)}
        </div>
      </details>}
      {names.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3"><SearchInput value={query.search} onChange={event => query.update({ metricSearch: event.target.value }, true)} placeholder="이름 또는 설명으로 지표 찾기" aria-label="이름 또는 설명으로 지표 찾기" wrapperClassName="w-full sm:w-80" /><span className="type-caption text-text-muted">자주 보는 지표를 최대 4개 고정할 수 있습니다.</span></div>}
      {GROUPS.map(group => {
        const items = displayed.filter(meta => groupFor(meta) === group);
        return items.length > 0 && <section key={group} aria-label={group} className="space-y-3"><h2 className="type-card-title text-text-base">{group}<span className="ml-2 type-caption text-text-muted">{items.length}</span></h2><div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">{items.map(meta => chart(meta))}</div></section>;
      })}
      {names.length === 0 ? empty ?? <EmptyState icon="monitoring" title="수신한 메트릭이 없습니다" description="OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다." />
        : visible.length === 0 && <EmptyState icon="search" title="일치하는 메트릭이 없습니다" description={`'${query.search.trim()}'와 일치하는 메트릭이 없습니다.`} action={{ label: '검색 초기화', onClick: () => query.update({ metricSearch: null }, true) }} />}
      {visible.length > visibleLimit && <div className="flex flex-wrap items-center gap-3"><span className="type-caption text-text-muted">{visible.length}개 중 {displayed.length}개 표시</span><Button variant="secondary" onClick={() => setVisibleLimit(value => value + 12)}>메트릭 12개 더 보기</Button></div>}
    </>}
  </div>;
}

export function AgentServiceMetricsTab({ agentId, serviceKey, ...common }: AgentProps) {
  const source: MetricSource = { kind: 'agent', agentId, serviceKey };
  const state = useMetricHealth(source, common.refreshKey);
  return <ServiceMetricsPanel key={`${agentId}:${serviceKey}`} {...common} source={source} state={state} showCollection />;
}
export function DirectServiceMetricsTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceMetricsPanel key={observedServiceId} {...common} source={{ kind: 'direct', observedServiceId }} showCollection={false} />;
}
