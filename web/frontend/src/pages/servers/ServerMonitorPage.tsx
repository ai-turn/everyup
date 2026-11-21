import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LoadErrorBanner, parseTimeRange, type GlobalTimeRange } from '../../components/common';
import { MoveTargetDialog } from '../../features/servers/components/MoveTargetDialog';
import { monitorPath, serverPath } from '../../features/servers/serverPaths';
import type { ServerRow } from '../../features/servers/serverStatus';
import { useMoveTarget } from '../../features/servers/useMoveTarget';
import { partialFailureMessage, useServers } from '../../features/servers/useServers';
import { listBack } from '../../features/targets/listBack';
import type { TargetHeader } from '../../features/targets/TargetHeader';
import { TargetMissing } from '../../features/targets/TargetMissing';
import { UptimeMonitorDetail } from '../../features/uptime/components/UptimeMonitorDetail';
import { monitorInput } from '../../features/uptime/monitorInput';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api } from '../../services/api';
import { readLatest, TargetGoneError } from '../../utils/readLatest';

const MISSING = {
  failed: '모니터 정보를 불러오지 못했습니다', failedDescription: '모니터 목록을 불러오지 못해 이 모니터를 확인할 수 없습니다.',
  notHere: '이 서버의 모니터가 아닙니다', gone: '다른 서버로 옮겨졌거나 삭제되었습니다.',
};

/**
 * 업타임 모니터 하나의 페이지(`/servers/:serverId/monitors/:monitorId`, DESIGN.md §4.7 대상 상세). 예전에는 서버의 업타임 탭 안에서
 * 서버 머리말과 탭 줄 아래에 그렸다. 머리말과 수치는 앱·Docker 서비스와 같다.
 */
export function ServerMonitorPage() {
  const { serverId = '', monitorId = '' } = useParams<{ serverId: string; monitorId: string }>();
  const { rows, error, failed, updatedAt, reload, poll, refresh: joinRefresh, busy, loaded, loading, forgetTarget } = useServers();
  const row = rows.find((candidate) => candidate.server.id === serverId);
  const found = row?.targets.monitors.some((candidate) => candidate.id === monitorId);
  // 모니터 목록을 불러오지 못했거나 이전 정보다. 이때는 "이 서버의 모니터가 아니다"라고 단정하지 않는다.
  const unverified = Boolean(error) || Boolean(row && (row.unknownCapabilities.includes('uptime') || row.staleCapabilities.includes('uptime')));

  // 자동 갱신과 새로고침은 서버 상세와 같다: 서버 데이터를 다시 불러오고, 모니터의 데이터도 새로고침 신호로 다시 불러온다.
  const [autoRefresh, setAutoRefresh] = useState(true);
  useAutoRefresh(poll, 30_000, autoRefresh);
  const [refreshToken, setRefreshToken] = useState(0);
  const changeAutoRefresh = (enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) { poll(); setRefreshToken((token) => token + 1); }
  };
  const { spinning, trigger: handleRefresh } = useSpinAction(() => { void joinRefresh(); setRefreshToken((token) => token + 1); });
  const refresh = { updatedAt, onRefresh: handleRefresh, refreshing: spinning || busy, autoRefresh, onAutoRefreshChange: changeAutoRefresh };

  if (!row || !found) return <TargetMissing row={row} loading={!loaded && !error} error={error} unverified={unverified} onRetry={() => void reload()} copy={MISSING} />;

  return (
    <MonitorPage key={`${row.server.id}/${monitorId}`} row={row} monitorId={monitorId} stale={unverified} refresh={refresh} refreshToken={refreshToken}
      autoRefresh={autoRefresh} onChanged={reload} forgetTarget={forgetTarget}
      banner={error
        ? <LoadErrorBanner title="서버 정보를 새로 불러오지 못했습니다" message={`이전에 불러온 정보입니다. ${error}`} onRetry={() => void reload()} retrying={loading} />
        : failed.length > 0 ? <LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={partialFailureMessage(failed)} onRetry={() => void reload()} retrying={loading} /> : null} />
  );
}

function MonitorPage({ row, monitorId, stale, refresh, refreshToken, autoRefresh, onChanged, forgetTarget, banner }: {
  row: ServerRow;
  monitorId: string;
  stale: boolean;
  refresh: Parameters<typeof TargetHeader>[0]['refresh'];
  refreshToken: number;
  autoRefresh: boolean;
  onChanged: () => Promise<void>;
  forgetTarget: ReturnType<typeof useServers>['forgetTarget'];
  banner: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const serverId = row.server.id;
  const list = serverPath(serverId, 'uptime');
  // 기간은 주소에 둔다(앱 페이지와 같다).
  const range: GlobalTimeRange = parseTimeRange(searchParams.get('range')) ?? '6h';
  const setRange = (next: GlobalTimeRange) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', next);
    setSearchParams(params);
  };
  // 업타임 탭의 목록으로 돌아간다. 목록에서 열었으면 그 목록의 검색·보기 방식을 되살린다. 처음 것을 기억한다.
  const [back] = useState(() => listBack(location.state, [{ path: list, label: '모니터 목록' }]) ?? { label: '모니터 목록', to: list });

  // 모니터를 만들거나 옮긴 뒤 이 화면으로 오면 포커스를 본문으로 옮긴다(서버 상세의 탭 패널과 같다, state.focusPanel).
  const pageRef = useRef<HTMLDivElement>(null);
  const focusPanel = (location.state as { focusPanel?: boolean } | null)?.focusPanel === true;
  useEffect(() => { if (focusPanel) pageRef.current?.focus(); }, [location.key, focusPanel]);

  const { moving, open: startMove, close: closeMove, markMoved } = useMoveTarget((id) => row.targets.monitors.find((monitor) => monitor.id === id), stale);
  const move = async (to: string) => {
    // 화면의 모니터가 아니라 지금의 모니터로 요청을 만든다. 그 사이의 일시정지를 되돌리지 않게.
    const latest = await readLatest(() => api.getUptimeMonitor(monitorId), '이동').catch(async (cause: unknown) => {
      if (cause instanceof TargetGoneError) { forgetTarget('monitors', monitorId); void onChanged(); }
      throw cause;
    });
    const updated = await api.updateUptimeMonitor(monitorId, monitorInput(latest, { serverId: to }));
    markMoved();
    // 옮긴 모니터를 새 서버의 행에 먼저 넣고 바로 그 주소로 간다. 다시 불러오기를 기다리면 모니터가 행에서 빠져 이 화면이 먼저 사라진다.
    forgetTarget('monitors', monitorId, updated);
    closeMove();
    navigate(monitorPath(to, monitorId), { replace: true, state: { focusPanel: true } });
    toast.success('업타임 모니터를 옮겼습니다');
    void onChanged();
  };
  // 지운 모니터를 행에서 먼저 빼고 목록으로 간다(다시 불러오기가 실패해도 남지 않게).
  const deleted = () => {
    forgetTarget('monitors', monitorId);
    navigate(back?.to ?? list, { replace: true, state: { focusPanel: true } });
    void onChanged();
  };

  return (
    <div ref={pageRef} tabIndex={-1}>
      <UptimeMonitorDetail monitorId={monitorId} crumbs={[{ label: row.server.name, to: serverPath(serverId) }]} back={back}
        refresh={refresh} range={range} onRangeChange={setRange} notice={banner} onDeleted={deleted} onChanged={onChanged}
        refreshToken={refreshToken} autoRefresh={autoRefresh}
        menuItems={[{ label: '다른 서버로 옮기기', icon: 'arrow_forward', onSelect: () => startMove(monitorId) }]} />
      {moving && <MoveTargetDialog kind="monitor" targetName={moving.name} currentServerId={serverId} onClose={closeMove} onMove={move} />}
    </div>
  );
}
