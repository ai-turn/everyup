import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import {
  Button, ButtonLink, EmptyState, FilterChips, ListToolbar, LoadErrorBanner, MaterialIcon, PageHeader, SearchInput, Select, type StatusTone,
} from '../../components/common';
import { ServerTable } from '../../features/servers/components/ServerTable';
import { ALL_LOGS_PATH, NEW_SERVER_PATH, rememberServersSearch } from '../../features/servers/serverPaths';
import { STATE_LABEL, type ServerRow } from '../../features/servers/serverStatus';
import { partialFailureMessage, useServers } from '../../features/servers/useServers';
import { UptimeRefreshControls } from '../../features/uptime/components/UptimeRefreshControls';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type ObservedServiceMetricName, type Project } from '../../services/api';
import { metricTitle } from '../../features/metrics/metricPresentation';

const STATUS_FILTERS: StatusTone[] = ['error', 'warn', 'idle', 'healthy'];
const parseStatus = (value: string | null) => STATUS_FILTERS.find((status) => status === value) ?? null;
const NO_GROUP = 'none';

// 서버 이름이 아니라 소속 대상이 일치하면 그 대상의 이름을 돌려준다. 서버 이름이 일치하면 빈 배열.
// 옛 메트릭 목록처럼 지표 이름으로도 찾는다. 일치한 지표는 "앱 이름 지표 이름"으로 보인다.
function matchTargets(row: ServerRow, query: string, catalog: ObservedServiceMetricName[]): string[] | null {
  if (!query || row.server.name.toLowerCase().includes(query)) return [];
  const { monitors, apps, infrastructure } = row.targets;
  const metrics = catalog.flatMap((metric) => {
    const app = apps.find((candidate) => candidate.id === metric.serviceId);
    const title = metricTitle(metric);
    return app && (metric.metricName.toLowerCase().includes(query) || title.toLowerCase().includes(query)) ? [`${app.name} ${title}`] : [];
  });
  const names = [
    ...monitors.filter((monitor) => monitor.name.toLowerCase().includes(query) || monitor.url.toLowerCase().includes(query)).map((monitor) => monitor.name),
    ...apps.filter((app) => app.name.toLowerCase().includes(query)).map((app) => app.name),
    ...(infrastructure?.name.toLowerCase().includes(query) ? [infrastructure.name] : []),
    ...new Set(metrics),
  ];
  return names.length ? names : null;
}

function ServerListSkeleton() {
  return <div role="status" className="space-y-label">
    <span className="sr-only">로딩 중…</span>
    {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-ui-hover-soft" />)}
  </div>;
}

export function ServersPage() {
  const [params, setParams] = useSearchParams();
  // 입력값은 로컬 상태가 쥔다. URL에 직접 묶으면 한글 조합 중 글자가 덮인다.
  const [query, setQueryInput] = useState(() => params.get('q') ?? '');
  // 이 화면이 쓰는 주소 변경은 모두 replace다. 그 밖의 이동(링크, 뒤로 가기)이면 검색창이 주소의 q를 따른다.
  const location = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => { rememberServersSearch(location.search); }, [location.search]);
  // 첫 기록의 key는 항상 default라 key만으로는 이동을 놓친다. 주소도 함께 본다.
  const seen = `${location.key}${location.search}`;
  const [seenLocation, setSeenLocation] = useState(seen);
  if (seen !== seenLocation) {
    setSeenLocation(seen);
    if (navigationType !== 'REPLACE') setQueryInput(params.get('q') ?? '');
  }
  const search = query.trim().toLowerCase();
  const status = parseStatus(params.get('status'));
  const requestedGroup = params.get('group');
  const { rows, loading, loaded, error, failed, metricCatalog, updatedAt, reload, poll, refresh: joinRefresh } = useServers();
  // 그룹 이름과 Docker 환경 안내는 보조 정보다. 실패해도 목록은 그린다.
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [hasDockerEnvironments, setHasDockerEnvironments] = useState(false);
  const [extrasKey, setExtrasKey] = useState(0);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([api.getProjects(), api.getAgents()]).then(([projectsResult, agentsResult]) => {
      if (!alive) return;
      setProjects(projectsResult.status === 'fulfilled' ? projectsResult.value ?? [] : null);
      setHasDockerEnvironments(agentsResult.status === 'fulfilled' && (agentsResult.value ?? []).length > 0);
    });
    return () => { alive = false; };
  }, [extrasKey]);

  const refresh = () => { void joinRefresh(); setExtrasKey((key) => key + 1); };
  useAutoRefresh(poll, 30_000);
  const { spinning, trigger: handleRefresh } = useSpinAction(refresh);

  const setParam = (key: string, value: string | null) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const setQuery = (value: string) => { setQueryInput(value); setParam('q', value); };
  const clearFilters = () => {
    setQueryInput('');
    setParams((current) => {
      const next = new URLSearchParams(current);
      ['q', 'status', 'group'].forEach((key) => next.delete(key));
      return next;
    }, { replace: true });
  };

  // 그룹 목록을 모르거나 없는 그룹이면 걸러지는 까닭이 화면에 보이지 않으므로 적용하지 않는다.
  const group = projects && (requestedGroup === NO_GROUP || projects.some((project) => project.id === requestedGroup)) ? requestedGroup : null;
  // 그룹 목록을 모르면 그룹 줄을 비운다(모르는 것을 `-`로 채우지 않는다).
  const groupName = (projectId?: string) => projects === null ? '' : projectId ? projects.find((project) => project.id === projectId)?.name ?? '' : '미분류';
  // 상태 칩의 개수는 검색어와 그룹을 따르고 상태 선택은 따르지 않는다. 고른 칩 옆의 다른 칩이 0이 되지 않는다.
  const { scoped, matches } = useMemo(() => {
    const found = new Map<string, string[]>();
    const list = rows.filter((row) => {
      if (group && (group === NO_GROUP ? Boolean(row.server.projectId) : row.server.projectId !== group)) return false;
      const matched = matchTargets(row, search, metricCatalog);
      if (matched === null) return false;
      found.set(row.server.id, matched);
      return true;
    });
    return { scoped: list, matches: found };
  }, [rows, group, search, metricCatalog]);
  const visible = status ? scoped.filter((row) => row.state === status) : scoped;
  const counts = Object.fromEntries(STATUS_FILTERS.map((key) => [key, scoped.filter((row) => row.state === key).length])) as Record<StatusTone, number>;
  const hasRows = rows.length > 0;

  return (
    // 머리말 → 툴바 → 목록은 페이지 블록 24px(page-stack), 알림 배너 → 목록은 16px이다.
    <div className="page-stack">
      {/* 개수를 가진 제목은 크럼과 다른 말이라 데스크톱에서도 보인다(DESIGN.md §3.4). 모르는 동안은 숫자만 비운다.
          갱신 시각과 전체 로그는 목록 밖의 일이라 툴바가 아니라 머리말의 meta다: 데스크톱은 AppHeader의 주 액션 앞, 모바일은 제목 아래. */}
      <PageHeader menu compactActions title="서버" count={hasRows || (loaded && !error) ? rows.length : null}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {hasRows && <UptimeRefreshControls updatedAt={updatedAt} onRefresh={handleRefresh} refreshing={spinning} />}
            {/* 여러 서버를 가로지르는 로그 요약(설계 6.6)은 사이드바에 없어 여기서 들어간다. 보조 이동이라 quiet다. */}
            <ButtonLink to={ALL_LOGS_PATH} variant="quiet">전체 로그</ButtonLink>
          </div>
        }>
        {/* 메뉴 첫 화면의 생성 버튼은 `추가` 하나다(DESIGN.md §4.1 액션 앵커). 대상은 화면 제목이 말한다. 그룹 목록과 같다. */}
        <ButtonLink to={NEW_SERVER_PATH}><MaterialIcon name="add" />추가</ButtonLink>
      </PageHeader>

      {hasRows && (
        <ListToolbar search={
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} resultCount={visible.length} shortcut placeholder="서버 또는 대상 검색" aria-label="서버 또는 대상 검색" />
        }>
          <FilterChips ariaLabel="상태로 거르기" value={status} onChange={(next) => setParam('status', next)}
            options={STATUS_FILTERS.map((key) => ({ value: key, label: STATE_LABEL[key], count: counts[key], tone: (key === 'error' || key === 'warn') && counts[key] === 0 ? 'idle' : key }))} />
          {projects !== null && (
            <Select aria-label="그룹으로 거르기" wrapperClassName="w-40" value={group ?? ''} onChange={(event) => setParam('group', event.target.value || null)}>
              <option value="">전체 그룹</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              <option value={NO_GROUP}>미분류</option>
            </Select>
          )}
        </ListToolbar>
      )}

      <div className="space-y-heading">
      {error && hasRows && (
        <LoadErrorBanner title="서버 목록을 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={reload} retrying={loading} />
      )}
      {!error && failed.length > 0 && (
        <LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={partialFailureMessage(failed)} onRetry={reload} retrying={loading} />
      )}

      {/* 한 번도 불러오지 못했으면 서버가 없는 것이 아니라 아직 모르는 것이다(매달린 첫 요청을 버린 뒤에도). */}
      {!loaded && !error ? <ServerListSkeleton />
        : error && !hasRows ? (
          <EmptyState icon="sync_problem" title="서버 목록을 불러오지 못했습니다" description={error}>
            <Button onClick={() => void reload()}>다시 시도</Button>
          </EmptyState>
        )
          : !hasRows ? (
            <EmptyState icon="dns" headingLevel="h2" title="아직 서버가 없습니다"
              description={`서버를 추가하고 업타임, 인프라, 로그, API 요청, 메트릭을 연결하세요.${hasDockerEnvironments ? ' Docker Collector가 수집한 데이터는 Docker 환경에서 확인합니다.' : ''}`}>
              <ButtonLink to={NEW_SERVER_PATH}>서버 추가</ButtonLink>
            </EmptyState>
          ) : (
            <section aria-label="서버" aria-busy={loading || undefined}>
              <h2 className="sr-only">서버 목록</h2>
              {visible.length > 0 ? <ServerTable rows={visible} matches={matches} groupName={groupName} />
                : <EmptyState icon="search" title="검색 결과가 없습니다" description="검색어를 바꾸거나 필터를 해제해 보세요." action={{ label: '필터 해제', onClick: clearFilters }} />}
            </section>
          )}
      </div>
    </div>
  );
}
