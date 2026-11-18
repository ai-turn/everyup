import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ButtonLink, EmptyState, LoadErrorBanner, Tabs, tabId, tabPanelId, type TabItem } from '../../components/common';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { ServerCapabilityPlaceholder } from '../../features/servers/components/ServerCapabilityPlaceholder';
import { MergeServerDialog } from '../../features/servers/components/MergeServerDialog';
import { ServerHeader } from '../../features/servers/components/ServerHeader';
import { ServerInfrastructureTab } from '../../features/servers/components/ServerInfrastructureTab';
import { ServerLogsTab } from '../../features/servers/components/ServerLogsTab';
import { ServerOverviewTab } from '../../features/servers/components/ServerOverviewTab';
import { ServerUptimeTab } from '../../features/servers/components/ServerUptimeTab';
import { DeleteServerDialog, ServerSettingsDialog } from '../../features/servers/components/ServerSettingsDialog';
import { SERVER_CAPABILITIES, SERVERS_PATH, serverPath, serversListPath, type ServerCapability } from '../../features/servers/serverPaths';
import { capabilityStateLabel, capabilityTargets, type ServerRow } from '../../features/servers/serverStatus';
import { useServers } from '../../features/servers/useServers';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type Project } from '../../services/api';

type ServerTab = 'overview' | ServerCapability;
const ID_PREFIX = 'server';

const TARGET_NOUN: Record<ServerCapability, string> = { uptime: '모니터', infrastructure: '리소스', logs: '앱', api: '앱', metrics: '앱' };

const targetName = (row: ServerRow, targetId: string) =>
  [...row.targets.monitors, ...row.targets.apps, ...(row.targets.infrastructure ? [row.targets.infrastructure] : [])]
    .find((target) => target.id === targetId)?.name;

export function ServerDetailPage() {
  const { serverId = '', capability: rawCapability, targetId } = useParams<{ serverId: string; capability?: string; targetId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const capability = SERVER_CAPABILITIES.find(({ key }) => key === rawCapability)?.key;
  const invalidCapability = rawCapability !== undefined && capability === undefined;
  const active: ServerTab = capability ?? 'overview';

  useEffect(() => {
    if (invalidCapability) navigate(serverPath(serverId), { replace: true });
  }, [invalidCapability, serverId, navigate]);

  // 키를 빠르게 연달아 누르면 다음 키가 새 주소로 다시 그려지기 전에 온다. 아직 그려지지 않은 키보드 이동을 기억한다.
  const pendingKeyboard = useRef<string | null>(null);
  useEffect(() => { pendingKeyboard.current = null; }, [location]);

  const { rows, error, failed, updatedAt, reload, loading } = useServers();
  const row = rows.find((candidate) => candidate.server.id === serverId);

  // 그룹 이름은 보조 정보다. 실패하면 그룹 칸만 숨긴다.
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectsKey, setProjectsKey] = useState(0);
  useEffect(() => {
    let alive = true;
    api.getProjects().then((result) => { if (alive) setProjects(result ?? []); }, () => { if (alive) setProjects(null); });
    return () => { alive = false; };
  }, [projectsKey]);

  const refresh = () => { reload(); setProjectsKey((key) => key + 1); };
  useAutoRefresh(reload, 30_000);
  // 머리말의 새로고침은 하나다. 서버 데이터와 함께 열린 패널의 데이터도 다시 불러온다.
  const [refreshToken, setRefreshToken] = useState(0);
  const { spinning, trigger: handleRefresh } = useSpinAction(() => { refresh(); setRefreshToken((token) => token + 1); });

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
  useEffect(() => {
    if (focusRequest > 0) panelRef.current?.focus();
  }, [focusRequest]);

  const target = row && targetId ? targetName(row, targetId) : undefined;
  useBreadcrumb(row ? [{ label: row.server.name, to: serverPath(row.server.id) }, ...(target ? [{ label: target }] : [])] : []);

  if (!row) {
    if (!updatedAt && !error) {
      return (
        // 서버 목록의 자리 표시(ServerListSkeleton)와 같은 방식: 머리말, 탭 줄, 행 몇 개.
        <div role="status" aria-busy="true" className="space-y-6">
          <span className="sr-only">로딩 중…</span>
          <div className="h-8 w-48 animate-pulse rounded-lg bg-ui-hover-soft" />
          <div className="h-10 animate-pulse rounded-lg bg-ui-hover-soft" />
          <div className="space-y-2">
            {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-ui-hover-soft" />)}
          </div>
        </div>
      );
    }
    if (error && rows.length === 0) {
      return <EmptyState icon="sync_problem" title="서버를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />;
    }
    return (
      <EmptyState icon="search_off" title="서버를 찾을 수 없습니다" description="삭제되었거나 주소가 잘못되었습니다.">
        <ButtonLink to={SERVERS_PATH}>서버 목록</ButtonLink>
      </EmptyState>
    );
  }

  const groupName = projects === null ? undefined
    : row.server.projectId ? projects.find((project) => project.id === row.server.projectId)?.name ?? '-' : '미분류';

  const tabs: TabItem<ServerTab>[] = [
    { key: 'overview', label: '개요' },
    ...SERVER_CAPABILITIES.map(({ key, label }): TabItem<ServerTab> => {
      const state = row.capabilities[key];
      // 모르는 기능은 연결 전이 아니다: 흐리게 두지 않고 상태 점도 붙이지 않는다.
      if (row.unknownCapabilities.includes(key)) return { key, label, caption: '확인 불가' };
      if (state === null) return { key, label, muted: true, caption: '연결 전' };
      return {
        key, label,
        srDetail: `, ${TARGET_NOUN[key]} ${capabilityTargets(row.targets, key).length}개`,
        ...(state === 'error' || state === 'warn' ? { tone: state, toneLabel: capabilityStateLabel(key, state) } : {}),
      };
    }),
  ];

  // 탭을 바꾸면 주소가 바뀌어 뒤로 가기로 돌아올 수 있다. 선택된 탭을 다시 누르면 그 탭의 첫 화면이다.
  // 화살표 키로 연달아 옮기면 기록 하나를 덮어써서, 뒤로 가기 한 번이면 키보드 탐색을 시작한 탭으로 돌아간다.
  const open = (tab: ServerTab, source?: 'keyboard') => {
    const next = tab === 'overview' ? serverPath(row.server.id) : serverPath(row.server.id, tab);
    if (next === (pendingKeyboard.current ?? location.pathname)) return;
    const keyboard = source === 'keyboard';
    const previousKeyboard = pendingKeyboard.current !== null || (location.state as { tabKeys?: boolean } | null)?.tabKeys === true;
    pendingKeyboard.current = keyboard ? next : null;
    navigate(next, { replace: keyboard && previousKeyboard, state: keyboard ? { tabKeys: true } : null });
  };

  return (
    <div>
      <ServerHeader row={row} groupName={groupName} onRefresh={handleRefresh} refreshing={spinning} onSettings={() => setDialog('settings')} />
      {error && <div className="mb-4"><LoadErrorBanner title="서버 정보를 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={reload} retrying={loading} /></div>}
      {!error && failed.length > 0 && (
        <div className="mb-4"><LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={`${failed.join(', ')} 정보를 제외한 결과입니다.`} onRetry={reload} retrying={loading} /></div>
      )}
      <div className="mb-6">
        <Tabs items={tabs} active={active} onChange={open} ariaLabel="서버 기능" idPrefix={ID_PREFIX} />
      </div>
      <div ref={panelRef} tabIndex={-1} role="tabpanel" id={tabPanelId(ID_PREFIX, active)} aria-labelledby={tabId(ID_PREFIX, active)}>
        {active === 'overview'
          ? <ServerOverviewTab row={row} onOpen={(capability) => open(capability)} />
          : active === 'uptime'
            ? <ServerUptimeTab row={row} targetId={targetId} onChanged={reload} unknown={row.unknownCapabilities.includes(active)}
              stale={Boolean(error)} onRetry={() => void reload()} refreshToken={refreshToken} />
            : active === 'infrastructure'
              ? <ServerInfrastructureTab row={row} targetId={targetId} onChanged={reload} unknown={row.unknownCapabilities.includes(active)}
                stale={Boolean(error)} onRetry={() => void reload()} refreshToken={refreshToken} />
              : active === 'logs'
                ? <ServerLogsTab row={row} targetId={targetId} onChanged={reload} unknown={row.unknownCapabilities.includes(active)}
                  stale={Boolean(error)} onRetry={() => void reload()} refreshToken={refreshToken} />
              : <ServerCapabilityPlaceholder key={active} row={row} capability={active} targetId={targetId} onChanged={reload}
              unknown={row.unknownCapabilities.includes(active)} stale={Boolean(error)} onRetry={() => void reload()} refreshToken={refreshToken} />}
      </div>
      {/* 대화 상자를 겹쳐 열지 않는다. 설정에서 합치기나 삭제를 고르면 설정을 닫고 그 대화 상자를 연다. */}
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
