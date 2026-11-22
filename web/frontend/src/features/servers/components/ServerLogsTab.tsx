import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { Button, ListViewToggle, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { useListView } from '../../../hooks/useListView';
import { api, type LogPattern, type LogServiceSummary, type ObservedService } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { LogServiceOverview } from '../../logs/components/LogServiceOverview';
import { logScopeKey, withLogSummaries } from '../../logs/logServiceRows';
import { connectAction, connectDone } from '../../connections/connectCopy';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { ALL_LOGS_PATH, appPath } from '../serverPaths';
import { capabilityTargets, type ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt, TabAction } from './ConnectPrompt';

/** 로그 탭: 로그 앱이 없으면 연결 안내, 있으면 서버 범위의 요약과 패턴, 앱 목록. 앱을 누르면 그 앱의 페이지(로그 탭)로 간다. */
export function ServerLogsTab({ row, onChanged, unknown, stale, onRetry, refreshToken, actionSlot }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // 설정 안내의 "로그 보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  const serverId = row.server.id;
  const logIds = new Set(capabilityTargets(row.targets, 'logs').map((target) => target.id));
  const apps = row.targets.apps.filter((app) => logIds.has(app.id));

  // 대화 상자가 앱을 만들었거나 신호를 더했다. 만들지 않고 닫으면 다시 불러올 것이 없다.
  const issued = useRef(false);
  const openSetup = () => { created.current = false; issued.current = false; setAdding(true); };

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫고 이동한다. 먼저 이동하면 새 앱이 아직 이 서버의 것으로 보이지 않는다.
  const finishCreate = async (id: string) => {
    if (created.current) return;
    created.current = true;
    await onChanged();
    setAdding(false);
    toast.success(connectDone('logs'));
    navigate(appPath(serverId, id, 'logs'), { state: { focusPanel: true } });
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(false);
    // 만든 뒤 닫기(X)로 닫았으면 새 앱을 불러온다.
    if (issued.current) void onChanged();
  };

  const label = connectAction('logs');
  const content = () => {
    // 이전 목록에 로그 앱이 없어도 다시 불러오지 못했으면 연결되지 않았다고 단정하지 않는다.
    if (unknown || (stale && apps.length === 0)) return <LoadErrorBanner inline title="로그 앱 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (apps.length === 0) {
      return (
        <ConnectPrompt title="이 서버의 로그를 연결하세요" description="앱의 OpenTelemetry 설정에 EveryUp 주소와 API Key를 넣으면 로그가 들어옵니다. 연결을 누르면 앱 이름을 정하고 키와 설정 예시를 받습니다.">
          <Button onClick={openSetup}><MaterialIcon name="add" />{label}</Button>
        </ConnectPrompt>
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
      {adding && <DirectTelemetrySetupDialog signal="logs" description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다."
        serverId={serverId} onClose={closeSetup} onIssued={() => { issued.current = true; }} onCreated={(service) => void finishCreate(service.id)} />}
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
      <div role="status" className="space-y-label">
        <span className="sr-only">로딩 중…</span>
        {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-ui-hover-soft" />)}
      </div>
    );
  }

  const base = apps.map((app) => ({
    key: logScopeKey({ serviceId: app.id }),
    name: app.name,
    stopped: !app.isActive,
    to: `${appPath(serverId, app.id, 'logs')}&range=24h`,
  }));
  const next = withLogSummaries(base, data.summaries, data.patterns ?? []);

  return (
    <div className="space-y-heading">
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
