import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ButtonLink, EmptyState, LoadErrorBanner, MaterialIcon, Tabs, tabId, tabPanelId, type TabItem } from '../../components/common';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { ServerCapabilityPlaceholder } from '../../features/servers/components/ServerCapabilityPlaceholder';
import { ServerHeader } from '../../features/servers/components/ServerHeader';
import { ServerOverviewTab } from '../../features/servers/components/ServerOverviewTab';
import { SERVER_CAPABILITIES, serverPath, type ServerCapability } from '../../features/servers/serverPaths';
import { STATE_LABEL, unknownCapabilities, type ServerRow } from '../../features/servers/serverStatus';
import { useServers } from '../../features/servers/useServers';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type Project } from '../../services/api';

type ServerTab = 'overview' | ServerCapability;
const ID_PREFIX = 'server';

const targetName = (row: ServerRow, targetId: string) =>
  [...row.targets.monitors, ...row.targets.apps, ...(row.targets.infrastructure ? [row.targets.infrastructure] : [])]
    .find((target) => target.id === targetId)?.name;

export function ServerDetailPage() {
  const { serverId = '', capability: rawCapability, targetId } = useParams<{ serverId: string; capability?: string; targetId?: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const capability = SERVER_CAPABILITIES.find(({ key }) => key === rawCapability)?.key;
  const invalidCapability = rawCapability !== undefined && capability === undefined;
  const active: ServerTab = capability ?? 'overview';

  useEffect(() => {
    if (invalidCapability) navigate(serverPath(serverId), { replace: true });
  }, [invalidCapability, serverId, navigate]);

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
  const { spinning, trigger: handleRefresh } = useSpinAction(refresh);

  const target = row && targetId ? targetName(row, targetId) : undefined;
  useBreadcrumb(row ? [{ label: row.server.name, to: serverPath(row.server.id) }, ...(target ? [{ label: target }] : [])] : []);

  if (!row) {
    if (!updatedAt && !error) {
      return (
        <div className="flex h-64 items-center justify-center gap-3 text-text-muted" aria-busy="true">
          <MaterialIcon size={24} name="sync" className="animate-spin" />
          <span>로딩 중…</span>
        </div>
      );
    }
    if (error && rows.length === 0) {
      return <EmptyState icon="sync_problem" title="서버를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />;
    }
    return (
      <EmptyState icon="search_off" title="서버를 찾을 수 없습니다" description="삭제되었거나 주소가 잘못되었습니다.">
        <ButtonLink to="/servers">서버 목록</ButtonLink>
      </EmptyState>
    );
  }

  const unknown = unknownCapabilities(failed);
  const groupName = projects === null ? undefined
    : row.server.projectId ? projects.find((project) => project.id === row.server.projectId)?.name ?? '-' : '미분류';

  const tabs: TabItem<ServerTab>[] = [
    { key: 'overview', label: '개요' },
    ...SERVER_CAPABILITIES.map(({ key, label }): TabItem<ServerTab> => {
      const state = row.capabilities[key];
      return {
        key, label,
        ...(state === 'error' || state === 'warn' ? { tone: state, toneLabel: STATE_LABEL[state] } : {}),
        ...(state === null && !unknown.has(key) ? { muted: true, caption: '연결 전' } : {}),
      };
    }),
  ];

  // 탭을 바꾸면 주소가 바뀌어 뒤로 가기로 돌아올 수 있다. 선택된 탭을 다시 누르면 그 탭의 첫 화면이다.
  const open = (tab: ServerTab) => {
    const next = tab === 'overview' ? serverPath(row.server.id) : serverPath(row.server.id, tab);
    if (next !== pathname) navigate(next);
  };

  return (
    <div>
      <ServerHeader row={row} groupName={groupName} onRefresh={handleRefresh} refreshing={spinning} />
      {error && <div className="mb-4"><LoadErrorBanner title="서버 정보를 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={reload} retrying={loading} /></div>}
      {!error && failed.length > 0 && (
        <div className="mb-4"><LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={`${failed.join(', ')} 정보를 제외한 결과입니다.`} onRetry={reload} retrying={loading} /></div>
      )}
      <div className="mb-6">
        <Tabs items={tabs} active={active} onChange={open} ariaLabel="서버 기능" idPrefix={ID_PREFIX} />
      </div>
      <div role="tabpanel" id={tabPanelId(ID_PREFIX, active)} aria-labelledby={tabId(ID_PREFIX, active)}>
        {active === 'overview'
          ? <ServerOverviewTab row={row} unknown={unknown} onOpen={open} />
          : <ServerCapabilityPlaceholder key={active} row={row} capability={active} targetId={targetId} onChanged={reload} />}
      </div>
    </div>
  );
}
