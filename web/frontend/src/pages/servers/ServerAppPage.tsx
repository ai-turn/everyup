import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { LoadErrorBanner, Tabs, tabId, tabPanelId } from '../../components/common';
import { connectObject, SIGNAL_TARGET } from '../../features/connections/connectCopy';
import { AppHeader } from '../../features/servers/app/AppHeader';
import { AppTabBody } from '../../features/servers/app/AppTabPanel';
import { appSummary } from '../../features/servers/app/appTabs';
import { useAppTabState } from '../../features/servers/app/useAppTabState';
import { useAttachSetup } from '../../features/servers/app/useAttachSetup';
import { MoveTargetDialog } from '../../features/servers/components/MoveTargetDialog';
import { ALL_LOGS_PATH, appPath, serverPath } from '../../features/servers/serverPaths';
import type { ServerRow } from '../../features/servers/serverStatus';
import { useMoveTarget } from '../../features/servers/useMoveTarget';
import { partialFailureMessage, useServers } from '../../features/servers/useServers';
import { TargetHeader } from '../../features/targets/TargetHeader';
import { TargetMissing } from '../../features/targets/TargetMissing';
import { listBack } from '../../features/targets/listBack';
import { DirectTelemetrySetupDialog } from '../../features/telemetry/components/DirectTelemetrySetupDialog';
import { useDirectServicePanel } from '../../features/telemetry/useDirectServicePanel';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useHeldToken } from '../../hooks/useHeldToken';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type ObservedService } from '../../services/api';
import { readLatest, TargetGoneError } from '../../utils/readLatest';

const ID_PREFIX = 'app';

const MISSING = {
  failed: '앱 정보를 불러오지 못했습니다', failedDescription: '앱 목록을 불러오지 못해 이 앱을 확인할 수 없습니다.',
  notHere: '이 서버의 앱이 아닙니다', gone: '다른 서버로 옮겨졌거나 연결이 해제되었습니다.',
};

/**
 * 직접 OpenTelemetry로 연결한 앱 하나의 페이지(`/servers/:serverId/apps/:appId`, DESIGN.md §4.7 대상 상세).
 * 예전에는 같은 앱이 서버의 로그·API 요청·메트릭 탭에 따로 나왔다. 이제 앱 하나가 한 페이지이고 데이터 유형이 탭이다.
 * 조각은 `features/servers/app/`에 있다: 탭 정의와 요약(appTabs), 탭·기간 주소 상태(useAppTabState), 이 앱에 데이터 유형
 * 더하기(useAttachSetup), 머리말(AppHeader), 탭 본문(AppTabPanel).
 */
export function ServerAppPage() {
  const { serverId = '', appId = '' } = useParams<{ serverId: string; appId: string }>();
  const { rows, error, failed, updatedAt, reload, poll, refresh: joinRefresh, busy, loaded, loading, forgetTarget } = useServers();
  const row = rows.find((candidate) => candidate.server.id === serverId);
  const app = row?.targets.apps.find((candidate) => candidate.id === appId);
  // 앱 목록을 불러오지 못했거나 이전 정보다. 이때는 "이 서버의 앱이 아니다"라고 단정하지 않는다.
  const unverified = Boolean(error) || Boolean(row && (['logs', 'api', 'metrics'] as const)
    .some((key) => row.unknownCapabilities.includes(key) || row.staleCapabilities.includes(key)));

  // 자동 갱신과 새로고침은 서버 상세와 같다: 서버 데이터를 다시 불러오고, 열린 탭도 새로고침 신호로 다시 불러온다.
  const [autoRefresh, setAutoRefresh] = useState(true);
  useAutoRefresh(poll, 30_000, autoRefresh);
  const [refreshToken, setRefreshToken] = useState(0);
  const changeAutoRefresh = (enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) { poll(); setRefreshToken((token) => token + 1); }
  };
  const { spinning, trigger: handleRefresh } = useSpinAction(() => { void joinRefresh(); setRefreshToken((token) => token + 1); });
  // 데이터 유형을 연결 해제한 뒤에는 앱 화면을 새로 그린다(확인 창과 열린 탭의 상태를 남기지 않는다).
  const [generation, setGeneration] = useState(0);
  const refresh = { updatedAt, onRefresh: handleRefresh, refreshing: spinning || busy, autoRefresh, onAutoRefreshChange: changeAutoRefresh };

  if (!row || !app) return <TargetMissing row={row} loading={!loaded && !error} error={error} unverified={unverified} onRetry={() => void reload()} copy={MISSING} />;

  return (
    <AppDetail key={`${row.server.id}/${app.id}/${generation}`} row={row} app={app} stale={unverified} refresh={refresh} refreshToken={refreshToken}
      onChanged={reload} forgetTarget={forgetTarget} onReset={() => setGeneration((value) => value + 1)}
      banner={error
        ? <LoadErrorBanner title="앱 정보를 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={() => void reload()} retrying={loading} />
        : failed.length > 0 ? <LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={partialFailureMessage(failed)} onRetry={() => void reload()} retrying={loading} /> : null} />
  );
}

function AppDetail({ row, app, stale, refresh, refreshToken, onChanged, forgetTarget, onReset, banner }: {
  row: ServerRow;
  app: ObservedService;
  stale: boolean;
  refresh: Parameters<typeof TargetHeader>[0]['refresh'];
  refreshToken: number;
  onChanged: () => Promise<void>;
  forgetTarget: ReturnType<typeof useServers>['forgetTarget'];
  onReset: () => void;
  banner: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const serverId = row.server.id;
  const { tab, current, range, setRange, openTab, traceId } = useAppTabState(app);
  const connected = app.signals.includes(current.signal);
  // 목록에서 열었으면 복귀 링크가 그 목록이다. 탭을 바꾸면 state가 사라지므로 처음 것을 기억한다.
  const [back] = useState(() => listBack(location.state, [
    { path: ALL_LOGS_PATH, label: '전체 로그' },
    ...(['logs', 'api', 'metrics'] as const).map((key) => ({ path: serverPath(serverId, key), label: '앱 목록' })),
  ]));

  // 앱을 만들거나 옮긴 뒤 이 화면으로 오면 포커스를 탭 패널로 옮긴다(서버 상세와 같다, state.focusPanel).
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = (location.state as { focusPanel?: boolean } | null)?.focusPanel === true;
  useEffect(() => { if (focusPanel) panelRef.current?.focus(); }, [location.key, focusPanel]);

  // 열린 탭의 데이터 유형이 연결 해제의 대상이다. 연결 전 탭이면 앱이 받는 첫 데이터 유형이다.
  const removalSignal = connected ? current.signal : app.signals[0];
  // 행에서 먼저 빼고(다시 불러오기가 실패해도 남지 않게) 바로 옮겨 간다. 다시 불러오기를 기다리면 앱이 행에서 빠져 이 화면이 먼저 사라진다.
  // 다른 데이터 유형이 남았으면 이 앱의 첫 탭, 앱을 지웠으면 서버의 그 기능 탭으로 간다.
  const removed = (remaining: ObservedService | null) => {
    forgetTarget('apps', app.id, remaining ?? undefined);
    if (remaining) onReset();
    navigate(remaining ? appPath(serverId, app.id) : serverPath(serverId, current.capability), { replace: true, state: { focusPanel: true } });
    void onChanged();
  };
  const { processing, connection, removalItem, dialogs } = useDirectServicePanel(app, removalSignal, removed, onChanged);
  const token = useHeldToken(refreshToken, processing);

  const { moving, open: startMove, close: closeMove, markMoved } = useMoveTarget((id) => row.targets.apps.find((candidate) => candidate.id === id), stale);
  const move = async (to: string) => {
    // 화면의 앱이 아니라 지금의 앱으로 요청을 만든다. 그 사이의 연결 해제를 되돌리지 않게.
    const latest = await readLatest(() => api.getObservedService(app.id), '이동').catch(async (cause: unknown) => {
      if (cause instanceof TargetGoneError) { forgetTarget('apps', app.id); void onChanged(); }
      throw cause;
    });
    const updated = await api.updateObservedService(app.id, { name: latest.name, serverId: to, signals: latest.signals });
    markMoved();
    // 옮긴 앱을 새 서버의 행에 먼저 넣고 바로 그 주소로 간다(새 서버의 앱 화면이 새로 그려진다).
    forgetTarget('apps', app.id, updated);
    closeMove();
    navigate(appPath(to, app.id, tab), { replace: true, state: { focusPanel: true } });
    toast.success('앱을 옮겼습니다');
    void onChanged();
  };

  const setup = useAttachSetup(openTab, onChanged);
  const { status, tabs, missing } = appSummary(row, app, stale);

  return (
    <div className="page-stack">
      <AppHeader row={row} app={app} summary={{ status, missing }} connection={connection} removalItem={removalItem} back={back}
        range={range} onRangeChange={setRange} refresh={refresh} onStartSetup={setup.startSetup} onStartMove={() => startMove(app.id)} />
      {banner}
      <div className="page-stack">
        <div className="min-w-0"><Tabs items={tabs} active={tab} onChange={openTab} ariaLabel="앱 데이터" idPrefix={ID_PREFIX} /></div>
        <div ref={panelRef} tabIndex={-1} role="tabpanel" id={tabPanelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)}>
          <AppTabBody tab={current} connected={connected} onConnect={() => setup.openSetup(current)}
            app={app} range={range} token={token} traceId={traceId} onRotateKey={connection.onRotateKey} onChanged={onChanged} />
        </div>
      </div>
      {dialogs}
      {setup.adding && <DirectTelemetrySetupDialog signal={setup.adding.signal} serverName={row.server.name}
        description={`${app.name} 앱에 ${connectObject(SIGNAL_TARGET[setup.adding.signal])} 더합니다.`} serverId={serverId} attachToId={app.id}
        onClose={setup.closeSetup} onIssued={setup.markIssued} onCreated={() => void setup.finishSetup()} />}
      {moving && <MoveTargetDialog kind="app" targetName={moving.name} signals={moving.signals} currentServerId={serverId}
        onClose={closeMove} onMove={move} />}
    </div>
  );
}
