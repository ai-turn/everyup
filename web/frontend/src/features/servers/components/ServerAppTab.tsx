import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { api } from '../../../services/api';
import { DirectApiPanel } from '../../telemetry/components/DirectApiPanel';
import { DirectMetricsPanel } from '../../telemetry/components/DirectMetricsPanel';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { serverPath } from '../serverPaths';
import { appState, capabilityStateLabel, capabilityTargets, worst, type ServerCapabilityTabProps } from '../serverStatus';
import { AppSelector } from './AppSelector';
import { ConnectPrompt } from './ConnectPrompt';
import { MoveTargetDialog } from './MoveTargetDialog';

const COPY = {
  api: {
    signal: 'traces', label: 'API 요청', dialogLabel: 'API', Panel: DirectApiPanel,
    connectTitle: '이 서버의 API 요청을 연결하세요', connectDescription: '앱이 OTLP로 트레이스를 보내면 요청 상태와 오류를 확인할 수 있습니다.',
  },
  metrics: {
    signal: 'metrics', label: '메트릭', dialogLabel: '메트릭', Panel: DirectMetricsPanel,
    connectTitle: '이 서버의 메트릭을 연결하세요', connectDescription: '앱이 OTLP로 보내는 메트릭을 확인합니다.',
  },
} as const;

/** API 요청 탭과 메트릭 탭: 앱이 없으면 연결 안내, 하나면 그 앱, 여럿이면 앱 선택과 선택한 앱. 여러 앱을 합친 화면은 없다. */
export function ServerAppTab({ row, targetId, onChanged, unknown, stale, onRetry, refreshToken, capability }: ServerCapabilityTabProps & { capability: 'api' | 'metrics' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const copy = COPY[capability];
  const [adding, setAdding] = useState(false);
  // 설정 안내의 "보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  // ID만 둔다. 옮길 때 최신 행에서 찾아야 그 사이의 변경을 되돌리지 않는다.
  const [movingId, setMovingId] = useState<string | null>(null);
  const serverId = row.server.id;
  const ids = new Set(capabilityTargets(row.targets, capability).map((target) => target.id));
  const apps = row.targets.apps.filter((app) => ids.has(app.id))
    .map((app) => ({ app, state: appState(app).state }))
    .sort((a, b) => a.app.name.localeCompare(b.app.name));
  const firstScreen = serverPath(serverId, capability);
  // ServerDetailPage가 이 표시를 보고 포커스를 탭 패널로 옮긴다.
  const show = (path: string) => navigate(path, { state: { focusPanel: true } });

  // 앱이 여럿이고 주소에 앱이 없으면 상태가 가장 나쁜 앱을 연다(같으면 이름순). 주소에 앱이 생기면 다시 고르지 않으므로
  // 자동 갱신으로 상태가 바뀌어도 보고 있던 앱에서 옮겨 가지 않는다.
  const worstState = worst(apps.map((entry) => entry.state));
  const pick = !targetId && !unknown && apps.length > 1 ? apps.find((entry) => entry.state === worstState)?.app.id : undefined;
  useEffect(() => {
    if (pick) navigate(`${serverPath(serverId, capability, pick)}${location.search}`, { replace: true, state: location.state });
  }, [pick, serverId, capability, navigate, location.search, location.state]);

  const openSetup = () => { created.current = false; setAdding(true); };

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫고 이동한다. 먼저 이동하면 새 앱이 아직 이 서버의 것으로 보이지 않는다.
  const finishCreate = async (id: string) => {
    if (created.current) return;
    created.current = true;
    await onChanged();
    setAdding(false);
    toast.success(`${copy.label}을 연결했습니다`);
    show(serverPath(serverId, capability, id));
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(false);
    // 만든 뒤 닫기(X)로 닫았을 수도 있다.
    void onChanged();
  };

  const move = async (id: string, to: string) => {
    const app = row.targets.apps.find((candidate) => candidate.id === id);
    if (!app) throw new Error('이 앱이 이 서버에 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    await api.updateObservedService(app.id, { name: app.name, serverId: to, signals: app.signals });
    await onChanged();
    setMovingId(null);
    toast.success('앱을 옮겼습니다');
    show(serverPath(to, capability, app.id));
  };

  const removed = async () => {
    await onChanged();
    show(firstScreen);
  };

  const moving = movingId ? row.targets.apps.find((app) => app.id === movingId) : undefined;
  const current = targetId ? apps.find((entry) => entry.app.id === targetId)?.app : apps.length === 1 ? apps[0].app : undefined;

  const content = () => {
    if (unknown) return <LoadErrorBanner inline title={`${copy.label} 앱 정보를 불러오지 못했습니다`} onRetry={onRetry} />;
    if (targetId && !current) {
      // 다시 불러오지 못해 이전 정보만 있으면 "이 서버의 것이 아니다"라고 단정하지 않는다.
      if (stale) return <LoadErrorBanner inline title="이 앱의 정보를 불러오지 못했습니다" onRetry={onRetry} />;
      return (
        <EmptyState icon="search_off" title="이 서버의 앱이 아닙니다" description={`다른 서버로 옮겨졌거나 ${copy.label} 연결이 해제되었습니다.`} headingLevel="h2">
          <ButtonLink variant="secondary" to={firstScreen}>이 서버의 {copy.label} 보기</ButtonLink>
        </EmptyState>
      );
    }
    if (apps.length === 0) {
      return (
        <ConnectPrompt title={copy.connectTitle} description={copy.connectDescription}>
          <Button onClick={openSetup}><MaterialIcon name="add" />{copy.label} 연결</Button>
        </ConnectPrompt>
      );
    }
    // 가장 나쁜 앱으로 옮겨 가는 중
    if (!current) return <div aria-busy="true" className="h-96 animate-pulse rounded-xl bg-ui-hover-soft" />;
    const { Panel } = copy;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          {apps.length > 1 && (
            <AppSelector ariaLabel={`${copy.label} 앱`} value={current.id}
              apps={apps.map(({ app, state }) => ({ id: app.id, name: app.name, state, stateLabel: capabilityStateLabel(capability, state) }))}
              // 다른 앱의 필터가 넘어가지 않게 쿼리를 버린다.
              onChange={(id) => navigate(serverPath(serverId, capability, id))} />
          )}
          <Button variant="secondary" className="ml-auto" onClick={openSetup}><MaterialIcon name="add" />앱 연결 추가</Button>
        </div>
        <Panel key={current.id} serviceId={current.id} service={current} back={{ label: '서버 개요', to: serverPath(serverId) }}
          onRemoved={() => void removed()} onChanged={onChanged} refreshToken={refreshToken}
          extraActions={<Button collapseLabel variant="secondary" onClick={() => setMovingId(current.id)}><MaterialIcon name="arrow_forward" />다른 서버로 옮기기</Button>} />
      </div>
    );
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 한 번만 보이는 키가 사라진다.
  return (
    <>
      {content()}
      {adding && <DirectTelemetrySetupDialog signal={copy.signal} capabilityLabel={copy.dialogLabel} title={`${copy.label} 연결`} description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다."
        serverId={serverId} onClose={closeSetup} onCreated={(service) => void finishCreate(service.id)} />}
      {moving && <MoveTargetDialog kind="app" targetName={moving.name} currentServerId={serverId}
        onClose={() => setMovingId(null)} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}
