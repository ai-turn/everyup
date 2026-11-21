import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button, ButtonLink, EmptyState, LoadErrorBanner, MaterialIcon, OverflowMenu, StatusLight, Tabs, parseTimeRange, tabId, tabPanelId,
  type CollectionStatus, type GlobalTimeRange, type TabItem,
} from '../../components/common';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { ApiExclusionsSettings } from '../../features/api-requests/ApiExclusionsSettings';
import { useRequestWindow } from '../../features/api-requests/useRequestQuery';
import { DirectServiceLogsTab } from '../../features/healthcheck/components/AgentServiceLogsTab';
import { DirectServiceMetricsTab } from '../../features/healthcheck/components/AgentServiceMetricsTab';
import { DirectServiceRequestsTab } from '../../features/healthcheck/components/AgentServiceRequestsTab';
import { DirectServiceTracesTab } from '../../features/healthcheck/components/AgentServiceTracesTab';
import { LogIngestLevels } from '../../features/logs/components/LogIngestLevels';
import { useMetricHealth } from '../../features/metrics/useMetricHealth';
import { ConnectPrompt } from '../../features/servers/components/ConnectPrompt';
import { MoveTargetDialog } from '../../features/servers/components/MoveTargetDialog';
import { ALL_LOGS_PATH, appPath, serverPath, type AppTab } from '../../features/servers/serverPaths';
import { appCapability, appPanelStatus, worst, type ServerRow } from '../../features/servers/serverStatus';
import { useMoveTarget } from '../../features/servers/useMoveTarget';
import { partialFailureMessage, useServers } from '../../features/servers/useServers';
import { TargetHeader } from '../../features/targets/TargetHeader';
import { TargetMissing } from '../../features/targets/TargetMissing';
import { listBack } from '../../features/targets/listBack';
import { DirectTelemetrySetupDialog } from '../../features/telemetry/components/DirectTelemetrySetupDialog';
import { receiptCollection, signalList } from '../../features/telemetry/signals';
import { useDirectServicePanel } from '../../features/telemetry/useDirectServicePanel';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useHeldToken } from '../../hooks/useHeldToken';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type ObservedService, type TelemetrySignal } from '../../services/api';
import { formatDateTime } from '../../utils/incidentFormat';
import { readLatest, TargetGoneError } from '../../utils/readLatest';

const ID_PREFIX = 'app';

// 탭 순서와 이름은 Docker 서비스 상세와 같다(업타임·인프라는 앱에 없다). capability는 서버 탭과 상태 판정의 이름이다.
const TABS: readonly { key: AppTab; label: string; signal: TelemetrySignal; capability: 'logs' | 'api' | 'metrics'; connect: string }[] = [
  { key: 'logs', label: '로그', signal: 'logs', capability: 'logs', connect: '앱의 OpenTelemetry 로그를 연결하면 이 탭에서 검색하고 추이를 봅니다.' },
  { key: 'requests', label: 'API 요청', signal: 'traces', capability: 'api', connect: '앱이 OpenTelemetry로 트레이스를 보내면 요청 상태와 오류를 확인할 수 있습니다.' },
  { key: 'traces', label: '트레이스', signal: 'traces', capability: 'api', connect: '앱이 OpenTelemetry로 트레이스를 보내면 요청이 거친 구간을 볼 수 있습니다.' },
  { key: 'metrics', label: '메트릭', signal: 'metrics', capability: 'metrics', connect: '앱이 OpenTelemetry로 보내는 메트릭을 차트로 확인합니다.' },
];
const DEFAULT_TAB: Record<'logs' | 'api' | 'metrics', AppTab> = { logs: 'logs', api: 'requests', metrics: 'metrics' };
const isAppTab = (value: string | null): value is AppTab => TABS.some((tab) => tab.key === value);

const MISSING = {
  failed: '앱 정보를 불러오지 못했습니다', failedDescription: '앱 목록을 불러오지 못해 이 앱을 확인할 수 없습니다.',
  notHere: '이 서버의 앱이 아닙니다', gone: '다른 서버로 옮겨졌거나 연결이 해제되었습니다.',
};

/**
 * 직접 OpenTelemetry로 연결한 앱 하나의 페이지(`/servers/:serverId/apps/:appId`, DESIGN.md §4.7 대상 상세).
 * 예전에는 같은 앱이 서버의 로그·API 요청·메트릭 탭에 따로 나왔다. 이제 앱 하나가 한 페이지이고 데이터 유형이 탭이다.
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

/** 앱의 상태(받는 데이터 유형 중 가장 나쁜 것, 서버 탭의 점과 같은 판정)와 탭 줄. */
function appSummary(row: ServerRow, app: ObservedService, stale: boolean) {
  const connected = (signal: TelemetrySignal) => app.signals.includes(signal);
  const statuses = TABS.filter((item, index) => connected(item.signal) && TABS.findIndex((other) => other.capability === item.capability) === index)
    .map((item) => appPanelStatus(row, item.capability, app, stale));
  const worstTone = worst(statuses.map((status) => status.tone));
  const tabs: TabItem<AppTab>[] = TABS.map((item) => {
    if (!connected(item.signal)) return { key: item.key, label: item.label, muted: true, caption: '연결 전' };
    const itemStatus = appPanelStatus(row, item.capability, app, stale);
    return { key: item.key, label: item.label, ...(itemStatus.tone === 'error' || itemStatus.tone === 'warn' ? { tone: itemStatus.tone, toneLabel: itemStatus.label } : {}) };
  });
  return { status: statuses.find((candidate) => candidate.tone === worstTone) ?? statuses[0], tabs, missing: TABS.find((item) => !connected(item.signal)) };
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
  const [searchParams, setSearchParams] = useSearchParams();
  const serverId = row.server.id;
  const connected = (signal: TelemetrySignal) => app.signals.includes(signal);
  const requested = searchParams.get('tab');
  const tab: AppTab = isAppTab(requested) ? requested : DEFAULT_TAB[appCapability(app)];
  const current = TABS.find((item) => item.key === tab)!;
  // 기간은 주소에 둔다(새로고침, 뒤로 가기에도 남는다). 바꾸면 요청 목록의 쪽 번호를 버린다.
  const range: GlobalTimeRange = parseTimeRange(searchParams.get('range')) ?? '6h';
  const setRange = (next: GlobalTimeRange) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', next);
    params.delete('page');
    setSearchParams(params);
  };
  // 목록에서 열었으면 복귀 링크가 그 목록이다. 탭을 바꾸면 state가 사라지므로 처음 것을 기억한다.
  const [back] = useState(() => listBack(location.state, [
    { path: ALL_LOGS_PATH, label: '전체 로그' },
    ...(['logs', 'api', 'metrics'] as const).map((key) => ({ path: serverPath(serverId, key), label: '앱 목록' })),
  ]));

  // 앱을 만들거나 옮긴 뒤 이 화면으로 오면 포커스를 탭 패널로 옮긴다(서버 상세와 같다, state.focusPanel).
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = (location.state as { focusPanel?: boolean } | null)?.focusPanel === true;
  useEffect(() => { if (focusPanel) panelRef.current?.focus(); }, [location.key, focusPanel]);

  // 화살표 키로 탭을 연달아 옮기면 기록 하나를 덮어쓴다(서버 상세, Docker 서비스 상세와 같다).
  const pendingKeyboard = useRef(false);
  useEffect(() => { pendingKeyboard.current = false; }, [location]);
  const openTab = (next: AppTab, source?: 'keyboard') => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    const keyboard = source === 'keyboard';
    const previousKeyboard = pendingKeyboard.current || (location.state as { tabKeys?: boolean } | null)?.tabKeys === true;
    pendingKeyboard.current = keyboard;
    setSearchParams(params, { replace: keyboard && previousKeyboard, state: keyboard ? { tabKeys: true } : null });
  };

  // 열린 탭의 데이터 유형이 연결 해제의 대상이다. 연결 전 탭이면 앱이 받는 첫 데이터 유형이다.
  const removalSignal = connected(current.signal) ? current.signal : app.signals[0];
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

  // 연결 전 탭에서 그 데이터 유형을 이 앱에 더한다.
  const [adding, setAdding] = useState<(typeof TABS)[number] | null>(null);
  const issued = useRef(false);
  const created = useRef(false);
  const openSetup = (item: (typeof TABS)[number]) => { issued.current = false; created.current = false; setAdding(item); };
  const finishSetup = async () => {
    if (created.current) return;
    created.current = true;
    const label = adding?.label;
    await onChanged();
    setAdding(null);
    toast.success(`${label}을 연결했습니다`);
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(null);
    if (issued.current) void onChanged();
  };

  const { status, tabs, missing } = appSummary(row, app, stale);

  return (
    <div className="page-stack">
      <TargetHeader
        title={app.name}
        crumbs={[{ label: row.server.name, to: serverPath(serverId) }]}
        back={back}
        status={<>
          <StatusLight tone={status.tone} label={status.label} />
          {status.detail && <span>{status.detail}</span>}
          {!status.stale && <span>마지막 수집 {app.lastSeenAt ? formatDateTime(app.lastSeenAt) : '아직 없음'}</span>}
          {/* 상태와 그 상태를 바꾸는 액션을 붙여 둔다. */}
          {connection.isActive && <Button variant="ghost" onClick={connection.onRevoke}><MaterialIcon name="block" />연결 중지</Button>}
        </>}
        // 직접 연결은 앱과 데이터 유형 단위다. 받지 않는 유형이 있으면 그 탭의 연결 안내로, 다 받으면 설정을 다시 받는다.
        connection={{
          kind: 'otel', detail: <>{signalList(app.signals)} 수신</>,
          action: missing ? { label: '데이터 추가', onClick: () => openTab(missing.key) } : { label: '설정 다시 받기', onClick: connection.onRotateKey },
        }}
        fieldsLabel="연결 정보"
        fields={[
          { label: 'API Key', value: <>
            <span className="truncate font-mono">{connection.apiKeyMasked || '마스킹된 키 없음'}</span>
            <Button variant="ghost" className="ml-auto" onClick={connection.onRotateKey}><MaterialIcon name="key" />키 재발급</Button>
          </> },
          { label: '수집 데이터', value: signalList(app.signals) },
          ...(connected('logs') ? [{ label: '수집 레벨', value: <LogIngestLevels observedServiceId={app.id} /> }] : []),
        ]}
        actions={<>
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: app.id })}>
            <MaterialIcon name="notifications" />알림 규칙
          </ButtonLink>
          <OverflowMenu items={[{ label: '다른 서버로 옮기기', icon: 'arrow_forward', onSelect: () => startMove(app.id) }, removalItem]} />
        </>}
        range={range}
        onRangeChange={setRange}
        refresh={refresh}
      />
      {banner}
      <div className="page-stack">
        <div className="min-w-0"><Tabs items={tabs} active={tab} onChange={openTab} ariaLabel="앱 데이터" idPrefix={ID_PREFIX} /></div>
        <div ref={panelRef} tabIndex={-1} role="tabpanel" id={tabPanelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)}>
          {!connected(current.signal) ? (
              <ConnectPrompt title={`이 앱의 ${current.label}을 연결하세요`} description={`${current.connect} 연결을 누르면 이 앱의 키에 권한을 더하고 설정 예시를 받습니다.`}>
                <Button onClick={() => openSetup(current)}><MaterialIcon name="add" />{current.label} 연결</Button>
              </ConnectPrompt>
            )
            : <AppTabPanel tab={tab} app={app} range={range} token={token} traceId={searchParams.get('traceId') ?? undefined}
                onRotateKey={connection.onRotateKey} onChanged={onChanged} />}
        </div>
      </div>
      {dialogs}
      {adding && <DirectTelemetrySetupDialog signal={adding.signal} capabilityLabel={adding.label} title={`${adding.label} 연결`}
        description={`${app.name} 앱에 ${adding.label}을 더합니다.`} serverId={serverId} attachToId={app.id}
        onClose={closeSetup} onIssued={() => { issued.current = true; }} onCreated={() => void finishSetup()} />}
      {moving && <MoveTargetDialog kind="app" targetName={moving.name} signals={moving.signals} currentServerId={serverId}
        onClose={closeMove} onMove={move} />}
    </div>
  );
}

/** 열린 탭의 본문. 데이터 화면은 Docker 서비스 상세와 같은 컴포넌트다(소스만 앱이다). 탭마다 필요한 조회만 한다. */
function AppTabPanel({ tab, app, range, token, traceId, onRotateKey, onChanged }: {
  tab: AppTab; app: ObservedService; range: GlobalTimeRange; token: number; traceId?: string; onRotateKey: () => void; onChanged: () => Promise<void>;
}) {
  if (tab === 'logs') return <DirectServiceLogsTab observedServiceId={app.id} refreshKey={token} range={range} traceId={traceId} />;
  if (tab === 'traces') return <AppTraces app={app} range={range} token={token} />;
  if (tab === 'requests') return <AppRequests app={app} range={range} token={token} traceId={traceId} onChanged={onChanged} />;
  return <AppMetrics app={app} range={range} token={token} onRotateKey={onRotateKey} />;
}

function AppTraces({ app, range, token }: { app: ObservedService; range: GlobalTimeRange; token: number }) {
  const window = useRequestWindow(range, token);
  return <DirectServiceTracesTab observedServiceId={app.id} refreshKey={token} range={range} window={window} />;
}

function AppRequests({ app, range, token, traceId, onChanged }: { app: ObservedService; range: GlobalTimeRange; token: number; traceId?: string; onChanged: () => Promise<void> }) {
  const window = useRequestWindow(range, token);
  // 트레이스 수신 기준. lastSeenAt은 로그 수신으로도 갱신되어 트레이스를 받은 적 없는 앱도 수신 중으로 보인다.
  const [collection, setCollection] = useState<CollectionStatus | undefined>();
  // 저장한 제외 경로. 서버 데이터를 다시 불러오기 전에도 개수가 맞게 이 값을 먼저 쓴다.
  const [savedPaths, setSavedPaths] = useState<string[] | null>(null);
  useEffect(() => {
    let current = true;
    api.getObservedServiceSetupStatus(app.id)
      .then((receipts) => { if (current) setCollection(receiptCollection(receipts, 'traces')); }, () => { if (current) setCollection(undefined); });
    return () => { current = false; };
  }, [app.id, token]);
  return (
    // 요청 → 제외 경로 설정 24px(group)
    <div className="page-stack">
      <DirectServiceRequestsTab observedServiceId={app.id} refreshKey={token} range={range} window={window} traceId={traceId} awaitingData={collection === 'waiting'} noun="앱" />
      <ApiExclusionsSettings key={app.id} serviceId={app.id} paths={savedPaths ?? app.apiExcludePaths ?? []}
        onSaved={(paths) => { setSavedPaths(paths); void onChanged(); }} />
    </div>
  );
}

function AppMetrics({ app, range, token, onRotateKey }: { app: ObservedService; range: GlobalTimeRange; token: number; onRotateKey: () => void }) {
  const metricHealth = useMetricHealth({ kind: 'direct', observedServiceId: app.id }, token);
  return (
    <DirectServiceMetricsTab observedServiceId={app.id} state={metricHealth} refreshKey={token} range={range} active={app.isActive} noun="앱"
      empty={app.isActive ? (
        <EmptyState icon="schedule" title="메트릭 수신 대기"
          description="앱을 다시 시작하면 1분 안에 첫 메트릭이 들어옵니다(내보내기 주기 기본 60초). 연결 설정이 없다면 API Key를 재발급해 새 설정을 받으세요."
          action={{ label: '설정 다시 받기', onClick: onRotateKey }} />
      ) : undefined} />
  );
}
