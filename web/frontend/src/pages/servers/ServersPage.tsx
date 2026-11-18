import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import {
  Button, ButtonLink, EmptyState, ListToolbar, LoadErrorBanner, MaterialIcon, PageHeader, SearchInput, Select, StatusLight, type StatusTone,
} from '../../components/common';
import { ServerTable } from '../../features/servers/components/ServerTable';
import { ALL_LOGS_PATH, NEW_SERVER_PATH, rememberServersSearch } from '../../features/servers/serverPaths';
import { STATE_LABEL, type ServerRow } from '../../features/servers/serverStatus';
import { partialFailureMessage, useServers } from '../../features/servers/useServers';
import { UptimeRefreshControls } from '../../features/uptime/components/UptimeRefreshControls';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type Project } from '../../services/api';

const STATUS_FILTERS: StatusTone[] = ['error', 'warn', 'idle', 'healthy'];
const parseStatus = (value: string | null) => STATUS_FILTERS.find((status) => status === value) ?? null;
const NO_GROUP = 'none';

// 서버 이름이 아니라 소속 대상이 일치하면 그 대상의 이름을 돌려준다. 서버 이름이 일치하면 빈 배열.
function matchTargets(row: ServerRow, query: string): string[] | null {
  if (!query || row.server.name.toLowerCase().includes(query)) return [];
  const { monitors, apps, infrastructure } = row.targets;
  const names = [
    ...monitors.filter((monitor) => monitor.name.toLowerCase().includes(query) || monitor.url.toLowerCase().includes(query)).map((monitor) => monitor.name),
    ...apps.filter((app) => app.name.toLowerCase().includes(query)).map((app) => app.name),
    ...(infrastructure?.name.toLowerCase().includes(query) ? [infrastructure.name] : []),
  ];
  return names.length ? names : null;
}

function ServerListSkeleton() {
  return <div role="status" className="space-y-2">
    <span className="sr-only">로딩 중…</span>
    {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-ui-hover-soft" />)}
  </div>;
}

export function ServersPage() {
  const [params, setParams] = useSearchParams();
  // 입력값은 로컬 상태가 쥔다. URL에 직접 묶으면 한글 조합 중 글자가 덮인다(AgentServiceCapabilityPage와 같은 이유).
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
  const { rows, loading, loaded, error, failed, updatedAt, reload, poll, refresh: joinRefresh } = useServers();
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
  const groupName = (projectId?: string) => projects === null ? '-' : projectId ? projects.find((project) => project.id === projectId)?.name ?? '-' : '미분류';
  const { visible, matches } = useMemo(() => {
    const found = new Map<string, string[]>();
    const list = rows.filter((row) => {
      if (status && row.state !== status) return false;
      if (group && (group === NO_GROUP ? Boolean(row.server.projectId) : row.server.projectId !== group)) return false;
      const matched = matchTargets(row, search);
      if (matched === null) return false;
      found.set(row.server.id, matched);
      return true;
    });
    return { visible: list, matches: found };
  }, [rows, status, group, search]);
  const counts = Object.fromEntries(STATUS_FILTERS.map((key) => [key, rows.filter((row) => row.state === key).length])) as Record<StatusTone, number>;
  const hasRows = rows.length > 0;

  return (
    <div>
      <PageHeader menu compactActions title="서버">
        <Button collapseLabel onClick={handleRefresh}><MaterialIcon name="refresh" className={spinning ? 'animate-spin' : ''} />새로고침</Button>
        {/* 메뉴 첫 화면의 생성 버튼은 `추가` 하나다(DESIGN.md §4.1 액션 앵커). 대상은 화면 제목이 말한다. 그룹 목록과 같다. */}
        <ButtonLink to={NEW_SERVER_PATH}><MaterialIcon name="add" />추가</ButtonLink>
      </PageHeader>

      {hasRows && (
        <ListToolbar search={
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} resultCount={visible.length} shortcut placeholder="서버 또는 대상 검색" aria-label="서버 또는 대상 검색" />
        }>
          <div role="group" aria-label="상태로 거르기" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {STATUS_FILTERS.map((key) => (
              <button key={key} type="button" aria-pressed={status === key} onClick={() => setParam('status', status === key ? null : key)}
                className="flex min-h-11 flex-col items-start gap-1 whitespace-nowrap rounded-lg px-2 py-1 transition-colors hover:bg-ui-hover-soft aria-pressed:bg-ui-hover sm:min-h-10 sm:flex-row sm:items-center sm:gap-2">
                <StatusLight label={STATE_LABEL[key]} tone={(key === 'error' || key === 'warn') && counts[key] === 0 ? 'idle' : key} />
                <span className="type-kpi">{counts[key]}</span>
              </button>
            ))}
          </div>
          {projects !== null && (
            <Select aria-label="그룹으로 거르기" wrapperClassName="w-40" value={group ?? ''} onChange={(event) => setParam('group', event.target.value || null)}>
              <option value="">전체 그룹</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              <option value={NO_GROUP}>미분류</option>
            </Select>
          )}
          {/* 여러 서버를 가로지르는 로그 요약(설계 6.6)은 사이드바에 없어 여기서 들어간다. 보조 이동이라 머리말의 주 조작과 섞지 않고
              툴바 끝의 텍스트 링크로 둔다. 갱신 시각은 서버 상세의 머리말과 같은 표기이고, 자동 갱신 스위치는 서버 상세에만 둔다. */}
          <div className="ml-auto flex flex-wrap items-center gap-x-3">
            <Link to={ALL_LOGS_PATH} className="inline-flex min-h-11 items-center type-body text-action link-underline sm:min-h-6">전체 로그</Link>
            <UptimeRefreshControls updatedAt={updatedAt} />
          </div>
        </ListToolbar>
      )}

      {error && hasRows && (
        <div className="mb-4"><LoadErrorBanner title="서버 목록을 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={reload} retrying={loading} /></div>
      )}
      {!error && failed.length > 0 && (
        <div className="mb-4"><LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={partialFailureMessage(failed)} onRetry={reload} retrying={loading} /></div>
      )}

      {/* 한 번도 불러오지 못했으면 서버가 없는 것이 아니라 아직 모르는 것이다(매달린 첫 요청을 버린 뒤에도). */}
      {!loaded && !error ? <ServerListSkeleton />
        : error && !hasRows ? <EmptyState icon="sync_problem" title="서버 목록을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
          : !hasRows ? (
            <EmptyState icon="dns" headingLevel="h2" title="아직 서버가 없습니다"
              description={`서버를 추가하고 업타임, 인프라, 로그, API 요청, 메트릭을 연결하세요.${hasDockerEnvironments ? ' Docker Collector가 수집한 데이터는 Docker 환경에서 확인합니다.' : ''}`}
              action={{ label: '서버 추가', to: NEW_SERVER_PATH }} />
          ) : (
            <section aria-label="서버" aria-busy={loading || undefined}>
              <h2 className="sr-only">서버 목록</h2>
              {visible.length > 0 ? <ServerTable rows={visible} matches={matches} groupName={groupName} />
                : <EmptyState icon="search" title="검색 결과가 없습니다" description="검색어를 바꾸거나 필터를 해제해 보세요." action={{ label: '필터 해제', onClick: clearFilters }} />}
            </section>
          )}
    </div>
  );
}
