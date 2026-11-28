import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, LoadErrorBanner, MaterialIcon, ResourceTable, StatusLight, Tooltip, type StatusTone } from '../../../components/common';
import { formatDateTime } from '../../../utils/incidentFormat';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { connectAction, connectDone, connectName } from '../../connections/connectCopy';
import { DockerRequestsSection } from '../../docker/DockerDataSections';
import { appPath } from '../serverPaths';
import { useConnectRequested } from '../useConnectRequested';
import { appPanelStatus, capabilityTargets, dockerCollects, type ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt, TabAction } from './ConnectPrompt';

const COPY = {
  api: {
    signal: 'traces', tab: 'requests',
    connectTitle: '이 서버의 API 요청을 연결하세요', connectDescription: '앱이 OpenTelemetry로 트레이스를 보내면 요청 상태와 오류를 확인할 수 있습니다. 연결을 누르면 앱 이름을 정하고 키와 설정 예시를 받습니다.',
  },
  metrics: {
    signal: 'metrics', tab: 'metrics',
    connectTitle: '이 서버의 메트릭을 연결하세요', connectDescription: '앱이 OpenTelemetry로 보내는 메트릭을 차트로 확인합니다. 연결을 누르면 앱 이름을 정하고 키와 설정 예시를 받습니다.',
  },
} as const;

// 상태가 나쁜 앱이 위다(서버 목록과 같은 순서). 같으면 이름순.
const STATE_ORDER: Record<StatusTone, number> = { error: 0, warn: 1, idle: 2, healthy: 3 };

/** API 요청 탭과 메트릭 탭: 앱이 없으면 연결 안내, 있으면 앱 목록. 앱을 누르면 그 앱의 페이지(그 탭)로 간다(DESIGN.md §4.7 대상 상세). */
export function ServerAppTab({ row, onChanged, unknown, stale, onRetry, actionSlot, capability, refreshToken }: ServerCapabilityTabProps & { capability: 'api' | 'metrics' }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 앱 페이지의 복귀 링크가 이 목록으로 돌아온다.
  const returnTo = `${location.pathname}${location.search}`;
  const copy = COPY[capability];
  // 개요의 `{기능} 연결`로 왔으면 연결 대화 상자를 연 채로 시작한다.
  const [adding, setAdding] = useState(useConnectRequested());
  // 설정 안내의 "보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  const serverId = row.server.id;
  const ids = new Set(capabilityTargets(row.targets, capability).map((target) => target.id));
  const apps = row.targets.apps.filter((app) => ids.has(app.id))
    // 이전 정보이면 확인 불가다. 메트릭 탭에서는 임계값을 넘은 앱이 확인 필요다(탭의 점과 같은 판정).
    .map((app) => ({ app, status: appPanelStatus(row, capability, app, Boolean(stale)) }))
    .sort((a, b) => STATE_ORDER[a.status.tone] - STATE_ORDER[b.status.tone] || a.app.name.localeCompare(b.app.name));

  // 대화 상자가 앱을 만들었거나 신호를 더했다. 만들지 않고 닫으면 다시 불러올 것이 없다.
  const issued = useRef(false);
  const openSetup = () => { created.current = false; issued.current = false; setAdding(true); };

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫고 이동한다. 먼저 이동하면 새 앱이 아직 이 서버의 것으로 보이지 않는다.
  const finishCreate = async (id: string) => {
    if (created.current) return;
    created.current = true;
    await onChanged();
    setAdding(false);
    toast.success(connectDone(capability));
    navigate(appPath(serverId, id, copy.tab), { state: { focusPanel: true } });
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(false);
    // 만든 뒤 닫기(X)로 닫았으면 새 앱을 불러온다.
    if (issued.current) void onChanged();
  };

  const label = connectAction(capability);
  const name = connectName(capability);
  // Docker Collector가 컨테이너의 요청을 모으면 그 추이가 API 요청 탭의 본문이다(ADR 0012). 앱 연결은 탭 줄의 조작 자리로 간다.
  const docker = capability === 'api' && dockerCollects(row.targets, 'api') ? row.targets.docker : undefined;
  const dockerRequests = docker && <DockerRequestsSection agentId={docker.id} refreshKey={refreshToken} />;
  const content = () => {
    // 이전 목록에 앱이 없어도 다시 불러오지 못했으면 연결되지 않았다고 단정하지 않는다.
    if (unknown || (stale && apps.length === 0)) return <LoadErrorBanner inline title={`${name} 앱 정보를 불러오지 못했습니다`} onRetry={onRetry} />;
    if (apps.length === 0 && dockerRequests) return dockerRequests;
    if (apps.length === 0) {
      return (
        <ConnectPrompt title={copy.connectTitle} description={copy.connectDescription}>
          <Button onClick={openSetup}><MaterialIcon name="add" />{label}</Button>
        </ConnectPrompt>
      );
    }
    const table = (
      <ResourceTable rows={apps} rowKey={({ app }) => app.id} ariaLabel={`${name} 앱`} columns={[
        { key: 'app', label: '앱', render: ({ app }) => (
          <Tooltip content={app.name}><Link data-row-link to={appPath(serverId, app.id, copy.tab)} state={{ returnTo }} className="block truncate font-medium text-text">{app.name}</Link></Tooltip>
        ) },
        { key: 'status', label: '상태', className: 'w-36 sm:w-48', render: ({ status }) => <StatusLight tone={status.tone} label={status.label} /> },
        { key: 'lastSeen', label: '마지막 수집', className: 'hidden w-40 sm:table-cell', align: 'right', render: ({ app, status }) => (
          <span className="text-text">{status.stale ? '-' : app.lastSeenAt ? formatDateTime(app.lastSeenAt) : '아직 없음'}</span>
        ) },
      ]} />
    );
    return dockerRequests ? <div className="space-y-section">{table}{dockerRequests}</div> : table;
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 한 번만 보이는 키가 사라진다.
  return (
    <>
      {content()}
      {!unknown && (apps.length > 0 || docker) && (
        <TabAction slot={actionSlot}><Button variant="secondary" onClick={openSetup}><MaterialIcon name="add" />{label}</Button></TabAction>
      )}
      {adding && <DirectTelemetrySetupDialog signal={copy.signal} serverName={row.server.name} description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다."
        serverId={serverId} onClose={closeSetup} onIssued={() => { issued.current = true; }} onCreated={(service) => void finishCreate(service.id)} />}
    </>
  );
}
