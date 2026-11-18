import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, ListViewToggle, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { useListView } from '../../../hooks/useListView';
import { api, type LogPattern, type LogServiceSummary, type ObservedService } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { LogServiceOverview } from '../../logs/components/LogServiceOverview';
import { logScopeKey, withLogSummaries } from '../../logs/logServiceRows';
import { DirectLogsPanel } from '../../telemetry/components/DirectLogsPanel';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { ALL_LOGS_PATH, CONNECT_LABEL, serverPath } from '../serverPaths';
import { capabilityTargets, type ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt, TabAction } from './ConnectPrompt';
import { useListReturn } from '../useListReturn';
import { MOVE_TARGET_UNCERTAIN, useMoveTarget } from '../useMoveTarget';
import { readLatest, TargetGoneError } from '../../../utils/readLatest';
import { MoveTargetDialog } from './MoveTargetDialog';
import { TabBackLink } from './TabBackLink';

/** 로그 탭: 로그 앱이 없으면 연결 안내, 있으면 서버 범위의 요약과 패턴, 앱 목록. 주소에 앱이 있으면 그 앱의 로그. */
export function ServerLogsTab({ row, targetId, onChanged, unknown, stale, onRetry, refreshToken, actionSlot, forgetTarget }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // 설정 안내의 "로그 보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  const serverId = row.server.id;
  const { moving, open: startMove, close: closeMove, markMoved } = useMoveTarget((id) => row.targets.apps.find((app) => app.id === id), Boolean(unknown || stale));
  const logIds = new Set(capabilityTargets(row.targets, 'logs').map((target) => target.id));
  const apps = row.targets.apps.filter((app) => logIds.has(app.id));
  const firstScreen = serverPath(serverId, 'logs');
  // 앱 목록의 보기 방식(?view=)은 주소에 있다. 목록에서 연 앱은 그 주소로 돌아간다.
  // 전체 로그에서 연 앱은 전체 로그로 돌아간다(여러 서버를 차례로 훑는 길).
  const listPath = useListReturn(firstScreen, targetId, [ALL_LOGS_PATH]);
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
    if (!app) throw new Error(unknown || stale ? MOVE_TARGET_UNCERTAIN : '이 앱이 이 서버에 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    // 화면의 앱이 아니라 지금의 앱으로 요청을 만든다. 그 사이의 신호 연결 해제를 되돌리지 않게.
    const latest = await readLatest(() => api.getObservedService(app.id), '이동').catch(async (cause: unknown) => {
      // 이미 지워졌으면 화면에서도 뺀다(대화 상자는 대상이 사라진 것을 보고 닫힌다).
      if (cause instanceof TargetGoneError) { forgetTarget?.('apps', app.id); void onChanged(); }
      throw cause;
    });
    const updated = await api.updateObservedService(app.id, { name: latest.name, serverId: to, signals: latest.signals });
    markMoved();
    // 다시 불러오기가 실패해도 옮긴 앱이 이 서버의 목록에 남지 않게 한다.
    forgetTarget?.('apps', app.id, updated);
    await onChanged();
    closeMove();
    toast.success('앱을 옮겼습니다');
    show(serverPath(to, 'logs', app.id));
  };

  // 다시 불러오기가 실패해도 지운 앱(해제한 신호)이 이전 목록에 남지 않게 먼저 반영한다.
  const removed = async (id: string, remaining: ObservedService | null) => {
    forgetTarget?.('apps', id, remaining ?? undefined);
    await onChanged();
    show(listPath);
  };

  const label = CONNECT_LABEL.logs;
  const current = targetId ? apps.find((app) => app.id === targetId) : undefined;

  const content = () => {
    if (unknown) return <LoadErrorBanner inline title="로그 앱 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (targetId && !current) {
      // 다시 불러오지 못해 이전 정보만 있으면 "이 서버의 것이 아니다"라고 단정하지 않는다.
      if (stale) return <LoadErrorBanner inline title="이 앱의 정보를 불러오지 못했습니다" onRetry={onRetry} />;
      return (
        <EmptyState icon="search_off" title="이 서버의 앱이 아닙니다" description="다른 서버로 옮겨졌거나 로그 연결이 해제되었습니다." headingLevel="h2">
          <ButtonLink variant="secondary" to={firstScreen}>로그 탭으로</ButtonLink>
        </EmptyState>
      );
    }
    if (apps.length === 0) {
      return (
        <ConnectPrompt title="이 서버의 로그를 연결하세요" description="앱의 OpenTelemetry 설정에 EveryUp 주소와 API Key를 넣으면 로그가 들어옵니다. 연결을 누르면 앱 이름을 정하고 키와 설정 예시를 받습니다.">
          <Button onClick={openSetup}><MaterialIcon name="add" />{label}</Button>
        </ConnectPrompt>
      );
    }
    if (current) {
      return (
        <DirectLogsPanel key={current.id} service={current}
          listLink={<TabBackLink label={listPath.startsWith(ALL_LOGS_PATH) ? '전체 로그' : '앱 목록'} to={listPath} />}
          onRemoved={(remaining) => void removed(current.id, remaining)} onChanged={onChanged} refreshToken={refreshToken}
          extraActions={<Button collapseLabel variant="secondary" onClick={() => startMove(current.id)}><MaterialIcon name="arrow_forward" />다른 서버로 옮기기</Button>} />
      );
    }
    return <ServerLogOverview serverId={serverId} apps={apps} refreshToken={refreshToken} />;
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 한 번만 보이는 키가 사라진다.
  return (
    <>
      {content()}
      {!unknown && apps.length > 0 && (
        <TabAction slot={actionSlot}><Button variant="secondary" onClick={openSetup}><MaterialIcon name="add" />{label}</Button></TabAction>
      )}
      {adding && <DirectTelemetrySetupDialog signal="logs" capabilityLabel="로그" title="로그 연결" description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다."
        serverId={serverId} onClose={closeSetup} onCreated={(service) => void finishCreate(service.id)} />}
      {moving && <MoveTargetDialog kind="app" targetName={moving.name} signals={moving.signals} currentServerId={serverId}
        onClose={closeMove} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}

/** 서버 범위의 앱 목록과 반복 패턴. 앱은 서버 상세가 불러온 것을 쓰고, 요약과 패턴만 여기서 불러온다. */
function ServerLogOverview({ serverId, apps, refreshToken }: {
  serverId: string;
  apps: ObservedService[];
  refreshToken: number;
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
        title="앱" noun="앱" onRetryPatterns={retry}
        viewToggle={<>
          {/* 여러 서버를 차례로 훑는 길. 전체 로그는 사이드바에 없다. */}
          <Link to={ALL_LOGS_PATH} className="inline-flex min-h-11 items-center type-body text-action link-underline sm:min-h-6">모든 서버의 로그</Link>
          <ListViewToggle view={view} onChange={setView} />
        </>} />
    </div>
  );
}
