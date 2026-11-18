import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, ListViewToggle, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { useListView } from '../../../hooks/useListView';
import { api, type LogPattern, type LogServiceSummary, type ObservedService } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { LogServiceOverview } from '../../logs/components/LogServiceOverview';
import { logScopeKey, withLogSummaries } from '../../logs/logServiceRows';
import { DirectLogsPanel } from '../../telemetry/components/DirectLogsPanel';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { serverPath } from '../serverPaths';
import { capabilityTargets, type ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt } from './ConnectPrompt';
import { MoveTargetDialog } from './MoveTargetDialog';

/** 로그 탭: 로그 앱이 없으면 연결 안내, 있으면 서버 범위의 요약과 패턴, 앱 목록. 주소에 앱이 있으면 그 앱의 로그. */
export function ServerLogsTab({ row, targetId, onChanged, unknown, stale, onRetry, refreshToken }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // 설정 안내의 "로그 보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  // ID만 둔다. 옮길 때 최신 행에서 찾아야 그 사이의 변경을 되돌리지 않는다.
  const [movingId, setMovingId] = useState<string | null>(null);
  const serverId = row.server.id;
  const logIds = new Set(capabilityTargets(row.targets, 'logs').map((target) => target.id));
  const apps = row.targets.apps.filter((app) => logIds.has(app.id));
  const firstScreen = serverPath(serverId, 'logs');
  // ServerDetailPage가 이 표시를 보고 포커스를 탭 패널로 옮긴다.
  const show = (path: string) => navigate(path, { state: { focusPanel: true } });

  const openSetup = () => { created.current = false; setAdding(true); };

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫고 이동한다. 먼저 이동하면 새 앱이 아직 이 서버의 것으로 보이지 않는다.
  const finishCreate = async (id: string) => {
    if (created.current) return;
    created.current = true;
    await onChanged();
    setAdding(false);
    toast.success('로그를 연결했습니다');
    show(serverPath(serverId, 'logs', id));
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
    show(serverPath(to, 'logs', app.id));
  };

  const removed = async () => {
    await onChanged();
    show(firstScreen);
  };

  const moving = movingId ? row.targets.apps.find((app) => app.id === movingId) : undefined;
  const current = targetId ? apps.find((app) => app.id === targetId) : undefined;

  const content = () => {
    if (unknown) return <LoadErrorBanner inline title="로그 앱 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (targetId && !current) {
      // 다시 불러오지 못해 이전 정보만 있으면 "이 서버의 것이 아니다"라고 단정하지 않는다.
      if (stale) return <LoadErrorBanner inline title="이 앱의 정보를 불러오지 못했습니다" onRetry={onRetry} />;
      return (
        <EmptyState icon="search_off" title="이 서버의 앱이 아닙니다" description="다른 서버로 옮겨졌거나 로그 연결이 해제되었습니다." headingLevel="h2">
          <ButtonLink variant="secondary" to={firstScreen}>이 서버의 로그 보기</ButtonLink>
        </EmptyState>
      );
    }
    if (apps.length === 0) {
      return (
        <ConnectPrompt title="이 서버의 로그를 연결하세요" description="서버에서 실행되는 앱이 OTLP로 로그를 보냅니다. 앱마다 연결을 하나씩 만듭니다.">
          <Button onClick={openSetup}><MaterialIcon name="add" />로그 연결</Button>
        </ConnectPrompt>
      );
    }
    if (current) {
      return (
        <DirectLogsPanel key={current.id} serviceId={current.id} service={current} back={{ label: '목록', to: firstScreen }}
          onRemoved={() => void removed()} onChanged={onChanged} refreshToken={refreshToken}
          extraActions={<Button collapseLabel variant="secondary" onClick={() => setMovingId(current.id)}><MaterialIcon name="arrow_forward" />다른 서버로 옮기기</Button>} />
      );
    }
    return <ServerLogOverview serverId={serverId} apps={apps} refreshToken={refreshToken} onAdd={openSetup} />;
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 한 번만 보이는 키가 사라진다.
  return (
    <>
      {content()}
      {adding && <DirectTelemetrySetupDialog signal="logs" capabilityLabel="로그" title="로그 연결" description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다."
        serverId={serverId} onClose={closeSetup} onCreated={(service) => void finishCreate(service.id)} />}
      {moving && <MoveTargetDialog kind="app" targetName={moving.name} currentServerId={serverId}
        onClose={() => setMovingId(null)} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}

/** 서버 범위의 앱 목록과 반복 패턴. 앱은 서버 상세가 불러온 것을 쓰고, 요약과 패턴만 여기서 불러온다. */
function ServerLogOverview({ serverId, apps, refreshToken, onAdd }: {
  serverId: string;
  apps: ObservedService[];
  refreshToken: number;
  onAdd: () => void;
}) {
  const { view, setView, returnTo } = useListView();
  const [data, setData] = useState<{ summaries: LogServiceSummary[]; patterns: LogPattern[] | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  // 앱이 생기거나 빠지면 요약도 다시 센다.
  const appKey = apps.map((app) => app.id).join(',');

  useEffect(() => {
    let alive = true;
    // 패턴은 보조 정보라, 실패해도 앱 목록은 그린다.
    Promise.all([api.getLogSummary(serverId), api.getLogPatterns({ serverId }).catch(() => null)])
      .then(([summaries, patterns]) => {
        if (!alive) return;
        setData({ summaries: summaries ?? [], patterns: patterns ?? null });
        setError(null);
      }, (cause: unknown) => { if (alive) setError(getErrorMessage(cause)); });
    return () => { alive = false; };
  }, [serverId, appKey, refreshToken, loadKey]);

  // 오류를 지워서 처음 실패한 뒤의 다시 시도는 로딩 자리 표시로 돌아간다. 이전 결과가 있으면 그대로 보인다.
  const retry = () => { setError(null); setLoadKey((key) => key + 1); };

  // 이전 결과가 있으면 다시 불러오다 실패해도 그대로 두고 알린다.
  if (!data) {
    if (error) return <LoadErrorBanner inline title="로그 요약을 불러오지 못했습니다" message={error} onRetry={retry} />;
    return (
      <div role="status" aria-busy="true" className="space-y-2">
        <span className="sr-only">로딩 중…</span>
        {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-ui-hover-soft" />)}
      </div>
    );
  }

  const base = apps.map((app) => ({
    key: logScopeKey({ serviceId: app.id }),
    name: app.name,
    stopped: !app.isActive,
    to: `${serverPath(serverId, 'logs', app.id)}?range=24h`,
  }));
  const next = withLogSummaries(base, data.summaries, data.patterns ?? []);

  return (
    <div className="space-y-4">
      {error && <LoadErrorBanner role="status" title="로그 요약을 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={retry} />}
      <LogServiceOverview rows={next.rows} patterns={data.patterns === null ? null : next.patterns} span={next.span} view={view} returnTo={returnTo}
        title="앱" onRetryPatterns={retry}
        viewToggle={<><ListViewToggle view={view} onChange={setView} /><Button variant="secondary" onClick={onAdd}><MaterialIcon name="add" />앱 연결 추가</Button></>} />
    </div>
  );
}
