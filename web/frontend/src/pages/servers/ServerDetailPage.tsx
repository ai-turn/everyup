import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ButtonLink, EmptyState, LoadErrorBanner, Tabs, tabId, tabPanelId, type TabItem } from '../../components/common';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { DockerContainersPanel } from '../../features/docker/DockerContainersPanel';
import { useDockerActions } from '../../features/docker/useDockerActions';
import { MonitoringSetupPanel } from '../../features/services/components/MonitoringSetupPanel';
import { ServerAppTab } from '../../features/servers/components/ServerAppTab';
import { MergeServerDialog } from '../../features/servers/components/MergeServerDialog';
import { ServerHeader } from '../../features/servers/components/ServerHeader';
import { ServerInfrastructureTab } from '../../features/servers/components/ServerInfrastructureTab';
import { ServerLogsTab } from '../../features/servers/components/ServerLogsTab';
import { ServerOverviewTab } from '../../features/servers/components/ServerOverviewTab';
import { ServerUptimeTab } from '../../features/servers/components/ServerUptimeTab';
import { DeleteServerDialog, ServerSettingsDialog } from '../../features/servers/components/ServerSettingsDialog';
import { SERVER_CAPABILITIES, SERVERS_PATH, serverPath, serversListPath, type ServerCapability } from '../../features/servers/serverPaths';
import { capabilityLabel, capabilityTargets, capabilityUnverified, type ServerCapabilityTabProps } from '../../features/servers/serverStatus';
import { partialFailureMessage, useServers } from '../../features/servers/useServers';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type Project } from '../../services/api';

// 컨테이너 탭은 Docker Collector가 있는 서버에만 있다(ADR 0012).
type ServerTab = 'overview' | 'containers' | ServerCapability;
const ID_PREFIX = 'server';

const TARGET_NOUN: Record<ServerCapability, string> = { uptime: '모니터', infrastructure: '리소스', logs: '앱', api: '앱', metrics: '앱' };

export function ServerDetailPage() {
  const { serverId = '', capability: rawCapability } = useParams<{ serverId: string; capability?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const capability = SERVER_CAPABILITIES.find(({ key }) => key === rawCapability)?.key;
  const containersTab = rawCapability === 'containers';
  const invalidCapability = rawCapability !== undefined && capability === undefined && !containersTab;
  const active: ServerTab = containersTab ? 'containers' : capability ?? 'overview';

  useEffect(() => {
    if (invalidCapability) navigate(serverPath(serverId), { replace: true });
  }, [invalidCapability, serverId, navigate]);

  // 키를 빠르게 연달아 누르면 다음 키가 새 주소로 다시 그려지기 전에 온다. 아직 그려지지 않은 키보드 이동을 기억한다.
  const pendingKeyboard = useRef<string | null>(null);
  useEffect(() => { pendingKeyboard.current = null; }, [location]);

  const { rows, error, failed, updatedAt, reload, poll, refresh: joinRefresh, busy, loaded, loading, forgetTarget } = useServers({ includeDocker: true });
  const row = rows.find((candidate) => candidate.server.id === serverId);
  // Docker Collector가 없는 서버의 컨테이너 주소는 개요로 보낸다.
  const noContainers = containersTab && Boolean(row) && row?.containers === null;
  useEffect(() => {
    if (noContainers) navigate(serverPath(serverId), { replace: true });
  }, [noContainers, serverId, navigate]);
  const dockerActions = useDockerActions(row?.targets.docker, {
    onChanged: () => void reload(),
    // 다른 대상이 없으면 서버도 사라진다. 남는 서버면 그 화면에 머문다.
    onDeactivated: () => { void reload(); if (row && !row.targets.monitors.length && !row.targets.apps.length) navigate(serversListPath(), { replace: true }); },
  });

  // 그룹 이름은 보조 정보다. 실패하면 그룹 칸만 숨긴다.
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectsKey, setProjectsKey] = useState(0);
  useEffect(() => {
    let alive = true;
    api.getProjects().then((result) => { if (alive) setProjects(result ?? []); }, () => { if (alive) setProjects(null); });
    return () => { alive = false; };
  }, [projectsKey]);

  const refresh = () => { reload(); setProjectsKey((key) => key + 1); };
  // 자동 갱신은 서버 수준에 하나다. 끄면 열린 패널의 주기적 갱신도 멈춘다(autoRefresh를 탭에 넘긴다).
  // 옛 업타임 목록처럼 화면 상태라 새로고침하면 다시 켜진다.
  const [autoRefresh, setAutoRefresh] = useState(true);
  useAutoRefresh(poll, 30_000, autoRefresh);
  // 다시 켜면 서버 데이터와 함께 열린 패널의 데이터도 바로 다시 불러온다(옛 패널의 스위치와 같다).
  const changeAutoRefresh = (enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) { poll(); setRefreshToken((token) => token + 1); }
  };
  // 머리말의 새로고침은 하나다. 서버 데이터와 함께 열린 패널의 데이터도 다시 불러온다.
  const [refreshToken, setRefreshToken] = useState(0);
  // 진행 중인 다시 불러오기가 있으면 새로 보내지 않고 합류한다. 직접 누른 것이라 회전은 바로 보인다.
  const { spinning, trigger: handleRefresh } = useSpinAction(() => {
    void joinRefresh(); setProjectsKey((key) => key + 1); setRefreshToken((token) => token + 1);
  });

  // 서버를 만든 뒤에 이 화면으로 오면 포커스를 탭 패널로 옮긴다.
  const [dialog, setDialog] = useState<'settings' | 'merge' | 'delete' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const found = Boolean(row);
  const focusPanel = (location.state as { focusPanel?: boolean } | null)?.focusPanel === true;
  useEffect(() => {
    if (focusPanel && found) panelRef.current?.focus();
  }, [location.key, focusPanel, found]);
  // 대화 상자가 닫힌 뒤 포커스가 body로 떨어지지 않게 탭 패널로 옮긴다.
  // 같은 커밋에서 대화 상자의 정리(트리거로 포커스 복귀)가 먼저 돌고 이 효과가 뒤에 돈다.
  const [focusRequest, setFocusRequest] = useState(0);
  // 탭 줄 오른쪽의 "현재 탭의 조작 자리". 탭이 자기 추가 버튼을 이 요소로 포털한다.
  // 콜백 ref의 setState는 커밋 중에 동기로 다시 그려지므로 첫 화면에서 버튼이 깜빡이지 않는다.
  const [actionSlot, setActionSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focusRequest > 0) panelRef.current?.focus();
  }, [focusRequest]);

  // 대상(앱, 모니터)은 자기 페이지가 있다(DESIGN.md §4.7 대상 상세). 서버 화면의 크럼은 서버까지다.
  useBreadcrumb(row ? [{ label: row.server.name, to: serverPath(row.server.id) }] : []);

  if (!row) {
    if (!loaded && !error) {
      return (
        // 서버 목록의 자리 표시(ServerListSkeleton)와 같은 방식: 머리말, 탭 줄, 행 몇 개.
        <div role="status" className="space-y-group">
          <span className="sr-only">로딩 중…</span>
          <div className="h-8 w-48 animate-pulse rounded-lg bg-ui-hover-soft" />
          <div className="h-10 animate-pulse rounded-lg bg-ui-hover-soft" />
          <div className="space-y-label">
            {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-ui-hover-soft" />)}
          </div>
        </div>
      );
    }
    // 서버 목록을 불러오지 못한 동안에는 이전 행에 없다고 해서 없는 서버라고 단정하지 않는다.
    if (error) {
      return <EmptyState icon="sync_problem" title="서버를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />;
    }
    return (
      // 화면 전체가 이 안내라 제목이 h1이다.
      <EmptyState icon="search_off" title="서버를 찾을 수 없습니다" description="삭제되었거나 주소가 잘못되었습니다." headingLevel="h1">
        <ButtonLink to={SERVERS_PATH}>서버 목록</ButtonLink>
      </EmptyState>
    );
  }

  const groupName = projects === null ? undefined
    : row.server.projectId ? projects.find((project) => project.id === row.server.projectId)?.name ?? '-' : '미분류';

  const containersTone = row.containers;
  const tabs: TabItem<ServerTab>[] = [
    { key: 'overview', label: '개요' },
    ...(containersTone === null ? [] : [{
      key: 'containers' as const, label: '컨테이너', srDetail: `, 컨테이너 ${row.targets.containers.length}개`,
      ...(containersTone === 'error' || containersTone === 'warn' ? { tone: containersTone, toneLabel: containersTone === 'error' ? '장애' : '확인 필요' } : {}),
    }]),
    ...SERVER_CAPABILITIES.map(({ key, label }): TabItem<ServerTab> => {
      const state = row.capabilities[key];
      // 모르는 기능은 연결 전이 아니다: 흐리게 두지 않고 상태 점도 붙이지 않는다.
      if (capabilityUnverified(row, key)) return { key, label, caption: '확인 불가' };
      if (state === null) return { key, label, muted: true, caption: '연결 전' };
      return {
        key, label,
        srDetail: `, ${TARGET_NOUN[key]} ${capabilityTargets(row.targets, key).length}개`,
        ...(state === 'error' || state === 'warn' ? { tone: state, toneLabel: capabilityLabel(row, key, state) } : {}),
      };
    }),
  ];

  // 이전 목록으로 그린 기능은 stale이다. unknown은 이전 목록도 없을 때뿐이다.
  const tabProps = (key: ServerCapability): ServerCapabilityTabProps => ({
    row, onChanged: reload, onRetry: () => void reload(), refreshToken, actionSlot, autoRefresh, forgetTarget,
    unknown: row.unknownCapabilities.includes(key), stale: Boolean(error) || row.staleCapabilities.includes(key),
  });

  // 탭을 바꾸면 주소가 바뀌어 뒤로 가기로 돌아올 수 있다. 선택된 탭을 다시 누르면 그 탭의 첫 화면이다.
  // 화살표 키로 연달아 옮기면 기록 하나를 덮어써서, 뒤로 가기 한 번이면 키보드 탐색을 시작한 탭으로 돌아간다.
  const open = (tab: ServerTab, source?: 'keyboard') => {
    const next = tab === 'overview' ? serverPath(row.server.id) : serverPath(row.server.id, tab);
    // 쿼리가 있거나 대상 화면이면 같은 탭을 눌러도 쿼리 없는 첫 화면으로 간다(설계 6.4절).
    if (next === (pendingKeyboard.current ?? `${location.pathname}${location.search}`)) return;
    const keyboard = source === 'keyboard';
    const previousKeyboard = pendingKeyboard.current !== null || (location.state as { tabKeys?: boolean } | null)?.tabKeys === true;
    pendingKeyboard.current = keyboard ? next : null;
    navigate(next, { replace: keyboard && previousKeyboard, state: keyboard ? { tabKeys: true } : null });
  };

  return (
    // 머리말 → 탭 → 패널은 페이지 블록 24px(page-stack), 알림 배너 → 탭은 16px이다.
    <div className="page-stack">
      <ServerHeader row={row} groupName={groupName} onRefresh={handleRefresh} refreshing={spinning || busy} onSettings={() => setDialog('settings')}
        updatedAt={updatedAt} autoRefresh={autoRefresh} onAutoRefreshChange={changeAutoRefresh}
        docker={row.targets.docker ? { primary: dockerActions.primary, menuItems: dockerActions.menuItems } : undefined} />
      <div className="space-y-heading">
      {error && <LoadErrorBanner title="서버 정보를 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={reload} retrying={loading} />}
      {!error && failed.length > 0 && (
        <LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={partialFailureMessage(failed)} onRetry={reload} retrying={loading} />
      )}
      {/* 탭 줄이 넘쳐 가로로 스크롤하는 좁은 화면에서는 조작 자리가 탭 줄 아래 한 줄로 내려간다(모바일은 폭 전체, 목록 복귀
          링크가 왼쪽 끝, 조작이 오른쪽 끝). 비어 있으면 높이가 없다. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 max-w-full">
          <Tabs items={tabs} active={active} onChange={open} ariaLabel="서버 기능" idPrefix={ID_PREFIX} />
        </div>
        <div ref={setActionSlot} role="group" aria-label="탭 조작" className="ml-auto flex flex-wrap items-center justify-end gap-2 empty:hidden max-sm:w-full" />
      </div>
      </div>
      <div ref={panelRef} tabIndex={-1} role="tabpanel" id={tabPanelId(ID_PREFIX, active)} aria-labelledby={tabId(ID_PREFIX, active)}>
        {active === 'overview'
          // Docker 설정 가이드는 서버 전체의 일이라 개요 맨 위다. 설정이 끝나면 한 줄로 접힌다(옛 Docker 환경 개요와 같다).
          ? <div className="space-y-section">{row.targets.docker && <MonitoringSetupPanel agent={row.targets.docker} services={row.targets.containers}
              onInstall={dockerActions.openInstall} onInstrument={dockerActions.openInstrumentation} onAddCapability={dockerActions.addCapability} />}<ServerOverviewTab row={row} /></div>
          : active === 'containers' ? (row.targets.docker ? <DockerContainersPanel agentId={row.targets.docker.id} containers={row.targets.containers} refreshToken={refreshToken} /> : null)
          : active === 'uptime' ? <ServerUptimeTab {...tabProps(active)} />
            : active === 'infrastructure' ? <ServerInfrastructureTab {...tabProps(active)} />
              : active === 'logs' ? <ServerLogsTab {...tabProps(active)} />
                // 두 탭이 같은 컴포넌트라, 탭을 바꿀 때 이전 탭의 상태(대화 상자 등)가 남지 않게 새로 그린다.
                : <ServerAppTab key={active} capability={active} {...tabProps(active)} />}
      </div>
      {/* 대화 상자를 겹쳐 열지 않는다. 설정에서 합치기나 삭제를 고르면 설정을 닫고 그 대화 상자를 연다. */}
      {dockerActions.dialogs}
      {dialog === 'settings' && (
        <ServerSettingsDialog row={row} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }}
          onMerge={() => setDialog('merge')} onDelete={() => setDialog('delete')} />
      )}
      {dialog === 'merge' && (
        <MergeServerDialog row={row} rows={rows} projects={projects} onClose={() => setDialog(null)} onReload={() => void reload()}
          onMerged={() => { setDialog(null); setFocusRequest((n) => n + 1); void reload(); }} />
      )}
      {dialog === 'delete' && (
        <DeleteServerDialog row={row} onClose={() => setDialog(null)} onFailed={reload}
          onDeleted={() => { setDialog(null); navigate(serversListPath(), { replace: true }); }} />
      )}
    </div>
  );
}
