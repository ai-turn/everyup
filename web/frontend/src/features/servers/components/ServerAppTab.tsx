import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { api, type ObservedService } from '../../../services/api';
import { DirectApiPanel } from '../../telemetry/components/DirectApiPanel';
import { DirectMetricsPanel } from '../../telemetry/components/DirectMetricsPanel';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { CONNECT_LABEL, serverPath } from '../serverPaths';
import { appCapabilityState, appPanelStatus, capabilityTargets, worst, type ServerCapabilityTabProps } from '../serverStatus';
import { AppSelector } from './AppSelector';
import { ConnectPrompt, PanelPlaceholder, TabAction } from './ConnectPrompt';
import { MOVE_TARGET_UNCERTAIN, useLeavingTarget, useMoveTarget } from '../useMoveTarget';
import { readLatest, TargetGoneError } from '../../../utils/readLatest';
import { MoveTargetDialog } from './MoveTargetDialog';

const COPY = {
  api: {
    signal: 'traces', label: 'API 요청', dialogLabel: 'API', Panel: DirectApiPanel,
    connectTitle: '이 서버의 API 요청을 연결하세요', connectDescription: '앱이 OpenTelemetry로 트레이스를 보내면 요청 상태와 오류를 확인할 수 있습니다. 연결을 누르면 앱 이름을 정하고 키와 설정 예시를 받습니다.',
  },
  metrics: {
    signal: 'metrics', label: '메트릭', dialogLabel: '메트릭', Panel: DirectMetricsPanel,
    connectTitle: '이 서버의 메트릭을 연결하세요', connectDescription: '앱이 OpenTelemetry로 보내는 메트릭을 차트로 확인합니다. 연결을 누르면 앱 이름을 정하고 키와 설정 예시를 받습니다.',
  },
} as const;

/** API 요청 탭과 메트릭 탭: 앱이 없으면 연결 안내, 하나면 그 앱, 여럿이면 앱 선택과 선택한 앱. 여러 앱을 합친 화면은 없다. */
export function ServerAppTab({ row, targetId, onChanged, unknown, stale, onRetry, refreshToken, actionSlot, capability, forgetTarget }: ServerCapabilityTabProps & { capability: 'api' | 'metrics' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const copy = COPY[capability];
  const [adding, setAdding] = useState(false);
  // 설정 안내의 "보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  const serverId = row.server.id;
  const { leaving, leave, mounted } = useLeavingTarget();
  const { moving, open: startMove, close: closeMove, markMoved } = useMoveTarget((id) => row.targets.apps.find((app) => app.id === id), Boolean(unknown || stale));
  const ids = new Set(capabilityTargets(row.targets, capability).map((target) => target.id));
  const apps = row.targets.apps.filter((app) => ids.has(app.id))
    // 메트릭 탭에서는 임계값을 넘은 앱이 확인 필요다. 기본 선택(가장 나쁜 앱)과 앱 선택의 표시가 이를 따른다.
    .map((app) => ({ app, ...appCapabilityState(row, capability, app) }))
    .sort((a, b) => a.app.name.localeCompare(b.app.name));
  const firstScreen = serverPath(serverId, capability);
  // ServerDetailPage가 이 표시를 보고 포커스를 탭 패널로 옮긴다.
  const show = (path: string) => navigate(path, { state: { focusPanel: true } });

  // 주소에 앱 없이 보여 준 앱(앱이 하나일 때). 같은 주소에 머무는 동안 앱이 늘어도 이 앱을 계속 보여 준다.
  // 탭을 다시 누르는 등 새로 이동하면(location.key가 바뀐다) 잊고 기본 선택을 다시 한다.
  const [shown, setShown] = useState<{ key: string; id: string } | null>(null);
  const remembered = !targetId && shown?.key === location.key ? apps.find((entry) => entry.app.id === shown.id)?.app : undefined;
  // 앱이 여럿이고 주소에 앱이 없으면 보던 앱, 없으면 상태가 가장 나쁜 앱을 연다(같으면 이름순). 주소에 앱이 생기면
  // 다시 고르지 않으므로 자동 갱신으로 상태가 바뀌어도 보고 있던 앱에서 옮겨 가지 않는다.
  const worstState = worst(apps.map((entry) => entry.state));
  const pick = !targetId && !unknown && apps.length > 1
    ? remembered?.id ?? apps.find((entry) => entry.state === worstState)?.app.id : undefined;
  useEffect(() => {
    if (pick) navigate(`${serverPath(serverId, capability, pick)}${location.search}`, { replace: true, state: location.state });
  }, [pick, serverId, capability, navigate, location.search, location.state]);

  // 대화 상자가 앱을 만들었거나 신호를 더했다. 만들지 않고 닫으면 다시 불러올 것이 없다.
  const issued = useRef(false);
  const openSetup = () => { created.current = false; issued.current = false; setAdding(true); };

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫고 이동한다. 먼저 이동하면 새 앱이 아직 이 서버의 것으로 보이지 않는다.
  const finishCreate = async (id: string) => {
    if (created.current) return;
    created.current = true;
    await onChanged();
    setAdding(false);
    toast.success(`${copy.label}을 연결했습니다`);
    if (mounted.current) show(serverPath(serverId, capability, id));
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(false);
    // 만든 뒤 닫기(X)로 닫았으면 새 앱을 불러온다.
    if (issued.current) void onChanged();
  };

  const move = async (id: string, to: string) => {
    const app = row.targets.apps.find((candidate) => candidate.id === id);
    if (!app) throw new Error(unknown || stale ? MOVE_TARGET_UNCERTAIN : '이 앱이 이 서버에 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    // 화면의 앱이 아니라 지금의 앱으로 요청을 만든다. 그 사이의 신호 연결 해제를 되돌리지 않게.
    const latest = await readLatest(() => api.getObservedService(app.id), '이동').catch(async (cause: unknown) => {
      // 이미 지워졌으면 화면에서도 뺀다(대화 상자는 대상이 사라진 것을 보고 닫힌다).
      if (cause instanceof TargetGoneError) { forgetTarget?.('apps', app.id); void onChanged(); }
      throw cause;
    });
    const updated = await api.updateObservedService(app.id, { name: latest.name, serverId: to, signals: latest.signals });
    markMoved();
    leave();
    // 다시 불러오기가 실패해도 옮긴 앱이 이 서버의 목록에 남지 않게 한다.
    forgetTarget?.('apps', app.id, updated);
    await onChanged();
    closeMove();
    toast.success('앱을 옮겼습니다');
    if (mounted.current) show(serverPath(to, capability, app.id));
  };

  // 다시 불러오기가 실패해도 지운 앱(해제한 신호)이 이전 목록에 남지 않게 먼저 반영한다.
  // 행은 바로 바뀌므로 화면을 옮길 때까지 자리 표시를 둔다(leave).
  const removed = async (id: string, remaining: ObservedService | null) => {
    leave();
    forgetTarget?.('apps', id, remaining ?? undefined);
    await onChanged();
    if (mounted.current) show(firstScreen);
  };

  const label = CONNECT_LABEL[capability];
  const current = targetId ? apps.find((entry) => entry.app.id === targetId)?.app
    : remembered ?? (apps.length === 1 ? apps[0].app : undefined);
  // 렌더링 중에 기억한다(React의 "이전 렌더의 정보 저장" 방식). 옮겨 가는 동안에도 같은 앱이라 패널이 다시 마운트되지 않는다.
  if (!targetId && current && (shown?.key !== location.key || shown.id !== current.id)) setShown({ key: location.key, id: current.id });

  const content = () => {
    if (leaving) return <PanelPlaceholder />;
    // 이전 목록에 앱이 없어도 다시 불러오지 못했으면 연결되지 않았다고 단정하지 않는다.
    if (unknown || (stale && apps.length === 0)) return <LoadErrorBanner inline title={`${copy.label} 앱 정보를 불러오지 못했습니다`} onRetry={onRetry} />;
    if (targetId && !current) {
      // 다시 불러오지 못해 이전 정보만 있으면 "이 서버의 것이 아니다"라고 단정하지 않는다.
      if (stale) return <LoadErrorBanner inline title="이 앱의 정보를 불러오지 못했습니다" onRetry={onRetry} />;
      return (
        <EmptyState icon="search_off" title="이 서버의 앱이 아닙니다" description={`다른 서버로 옮겨졌거나 ${copy.label} 연결이 해제되었습니다.`} headingLevel="h2">
          <ButtonLink variant="secondary" to={firstScreen}>{copy.label} 탭으로</ButtonLink>
        </EmptyState>
      );
    }
    if (apps.length === 0) {
      return (
        <ConnectPrompt title={copy.connectTitle} description={copy.connectDescription}>
          <Button onClick={openSetup}><MaterialIcon name="add" />{label}</Button>
        </ConnectPrompt>
      );
    }
    // 가장 나쁜 앱으로 옮겨 가는 중
    if (!current) return <PanelPlaceholder />;
    const { Panel } = copy;
    return (
      <div className="page-stack">
        {/* 앱이 하나면 고를 것이 없으므로 줄째 없다. 추가 버튼은 탭 줄의 조작 자리에 있다. */}
        {apps.length > 1 && (
          <AppSelector ariaLabel={`${copy.label} 앱`} value={current.id}
            // 이전 정보이면 패널의 상태 줄과 같이 확인 불가다.
            apps={apps.map(({ app }) => {
              const status = appPanelStatus(row, capability, app, Boolean(stale));
              return { id: app.id, name: app.name, state: status.tone, stateLabel: status.label };
            })}
            // 다른 앱의 필터가 넘어가지 않게 쿼리를 버린다.
            onChange={(id) => navigate(serverPath(serverId, capability, id))} />
        )}
        <Panel key={current.id} service={current} status={appPanelStatus(row, capability, current, Boolean(stale))}
          onRemoved={(remaining) => void removed(current.id, remaining)} onChanged={onChanged} refreshToken={refreshToken}
          extraActions={<Button collapseLabel variant="secondary" onClick={() => startMove(current.id)}><MaterialIcon name="arrow_forward" />다른 서버로 옮기기</Button>} />
      </div>
    );
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 한 번만 보이는 키가 사라진다.
  return (
    <>
      {content()}
      {!unknown && apps.length > 0 && (
        <TabAction slot={actionSlot}><Button variant="secondary" onClick={openSetup}><MaterialIcon name="add" />{label}</Button></TabAction>
      )}
      {adding && <DirectTelemetrySetupDialog signal={copy.signal} capabilityLabel={copy.dialogLabel} title={`${copy.label} 연결`} description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다."
        serverId={serverId} onClose={closeSetup} onIssued={() => { issued.current = true; }} onCreated={(service) => void finishCreate(service.id)} />}
      {moving && <MoveTargetDialog kind="app" targetName={moving.name} signals={moving.signals} currentServerId={serverId}
        onClose={closeMove} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}
