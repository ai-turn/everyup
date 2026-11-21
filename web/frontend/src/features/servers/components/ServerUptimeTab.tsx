import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { UptimeMonitorDialog } from '../../uptime/components/UptimeMonitorDialog';
import { UptimeMonitorList } from '../../uptime/components/UptimeMonitorList';
import { UptimeMonitorPanel } from '../../uptime/components/UptimeMonitorPanel';
import { monitorInput } from '../../uptime/monitorInput';
import { api, type UptimeMonitorInput } from '../../../services/api';
import { ADD_MONITOR_STATE, CONNECT_LABEL, serverPath } from '../serverPaths';
import type { ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt, PanelPlaceholder, TabAction } from './ConnectPrompt';
import { useListReturn } from '../useListReturn';
import { MOVE_TARGET_UNCERTAIN, useLeavingTarget, useMoveTarget } from '../useMoveTarget';
import { readLatest, TargetGoneError } from '../../../utils/readLatest';
import { MoveTargetDialog } from './MoveTargetDialog';
import { TabBackLink } from './TabBackLink';

/** 업타임 탭: 모니터가 없으면 연결 안내, 하나면 그 상세, 여럿이면 목록. 주소에 모니터가 있으면 그 상세. */
export function ServerUptimeTab({ row, targetId, onChanged, unknown, stale, onRetry, refreshToken, actionSlot, autoRefresh, forgetTarget }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const addRequested = (location.state as Record<string, unknown> | null)?.[ADD_MONITOR_STATE] === true;
  const [adding, setAdding] = useState(addRequested);
  // 개요의 첫 버튼이 넘긴 표시는 한 번만 쓴다. 기록에서 지워서 새로고침이나 뒤로 가기로 대화 상자가 다시 열리지 않게 한다.
  useEffect(() => {
    if (addRequested) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [addRequested, location.pathname, location.search, navigate]);
  const serverId = row.server.id;
  const monitors = row.targets.monitors;
  const { leaving, leave, mounted } = useLeavingTarget();
  const { moving, open: startMove, close: closeMove, markMoved } = useMoveTarget((id) => monitors.find((monitor) => monitor.id === id), Boolean(unknown || stale));
  const firstScreen = serverPath(serverId, 'uptime');
  // 목록에서 연 상세는 그 목록의 주소(검색어, 필터, 보기 방식)로 돌아간다.
  const listPath = useListReturn(firstScreen, targetId);
  // ServerDetailPage가 이 표시를 보고 포커스를 탭 패널로 옮긴다.
  const show = (path: string) => navigate(path, { state: { focusPanel: true } });

  // 대화 상자를 먼저 닫는다. 닫힐 때 포커스가 연 버튼으로 돌아가므로, 그 뒤에 화면을 바꿔야 포커스가 패널에 남는다.
  // 서버 데이터를 다시 불러온 뒤에 이동한다. 먼저 이동하면 새 모니터가 아직 이 서버의 것으로 보이지 않는다.
  const create = async (input: UptimeMonitorInput) => {
    const created = await api.createUptimeMonitor({ ...input, serverId });
    await onChanged();
    setAdding(false);
    toast.success('업타임 모니터를 추가했습니다');
    if (mounted.current) show(serverPath(serverId, 'uptime', created.id));
  };

  const move = async (id: string, to: string) => {
    const monitor = monitors.find((candidate) => candidate.id === id);
    if (!monitor) throw new Error(unknown || stale ? MOVE_TARGET_UNCERTAIN : '이 모니터가 이 서버에 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    // 화면의 모니터가 아니라 지금의 모니터로 요청을 만든다. 그 사이의 일시정지를 되돌리지 않게.
    const latest = await readLatest(() => api.getUptimeMonitor(monitor.id), '이동').catch(async (cause: unknown) => {
      // 이미 지워졌으면 화면에서도 뺀다(대화 상자는 대상이 사라진 것을 보고 닫힌다).
      if (cause instanceof TargetGoneError) { forgetTarget?.('monitors', monitor.id); void onChanged(); }
      throw cause;
    });
    const updated = await api.updateUptimeMonitor(monitor.id, monitorInput(latest, { serverId: to }));
    markMoved();
    leave();
    // 다시 불러오기가 실패해도 옮긴 모니터가 이 서버의 목록에 남지 않게 한다.
    forgetTarget?.('monitors', monitor.id, updated);
    await onChanged();
    closeMove();
    toast.success('업타임 모니터를 옮겼습니다');
    if (mounted.current) show(serverPath(to, 'uptime', monitor.id));
  };

  // 삭제 뒤의 다시 불러오기가 실패해도 지운 모니터가 이전 목록에서 다시 보이지 않게 먼저 뺀다. 행은 바로 바뀌므로
  // 화면을 옮길 때까지 자리 표시를 둔다(leave).
  const removed = async (id: string) => {
    leave();
    forgetTarget?.('monitors', id);
    await onChanged();
    if (mounted.current) show(listPath);
  };

  const current = targetId ? monitors.find((monitor) => monitor.id === targetId) : monitors.length === 1 ? monitors[0] : undefined;
  const label = CONNECT_LABEL.uptime;
  const addButton = <Button variant="secondary" onClick={() => setAdding(true)}><MaterialIcon name="add" />{label}</Button>;
  // 모니터가 둘 이상이면 상세에서 목록으로 돌아가는 길을 둔다. 하나면 그 상세가 탭의 첫 화면이다.
  const several = monitors.length > 1;

  const content = () => {
    if (leaving) return <PanelPlaceholder />;
    // 이전 목록에 모니터가 없어도 다시 불러오지 못했으면 연결되지 않았다고 단정하지 않는다.
    if (unknown || (stale && monitors.length === 0)) return <LoadErrorBanner inline title="업타임 모니터 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (targetId && !current) {
      // 다시 불러오지 못해 이전 정보만 있으면 "이 서버의 것이 아니다"라고 단정하지 않는다.
      if (stale) return <LoadErrorBanner inline title="이 모니터의 정보를 불러오지 못했습니다" onRetry={onRetry} />;
      return (
        <EmptyState icon="search_off" title="이 서버의 모니터가 아닙니다" description="다른 서버로 옮겨졌거나 삭제되었습니다." headingLevel="h2">
          <ButtonLink variant="secondary" to={firstScreen}>업타임 탭으로</ButtonLink>
        </EmptyState>
      );
    }
    if (monitors.length === 0) {
      return (
        <ConnectPrompt title="이 서버의 업타임 모니터를 추가하세요" description="확인할 URL이나 호스트와 포트만 입력하면 됩니다. 서버에 설치할 것은 없습니다.">
          <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />{label}</Button>
        </ConnectPrompt>
      );
    }
    if (current) {
      return (
        <UptimeMonitorPanel key={current.id} monitorId={current.id}
          back={several ? { label: '업타임 탭으로', to: listPath } : { label: '서버 개요', to: serverPath(serverId) }}
          onDeleted={() => void removed(current.id)} onChanged={onChanged} refreshToken={refreshToken} autoRefresh={autoRefresh}
          menuItems={[{ label: '다른 서버로 옮기기', icon: 'arrow_forward', onSelect: () => startMove(current.id) }]} />
      );
    }
    // 목록은 서버 상세가 불러온 모니터를 쓴다. 갱신의 주체는 서버 상세 하나다. 보기 전환은 탭 줄의 조작 자리에서 추가 버튼 앞이다.
    return (
      <UptimeMonitorList monitors={monitors} stale={stale} onDeleted={(ids) => ids.forEach((id) => forgetTarget?.('monitors', id))} searchLabel="모니터 검색"
        hrefFor={(monitor) => serverPath(serverId, 'uptime', monitor.id)} onChanged={onChanged}
        renderControls={({ viewToggle }) => <TabAction slot={actionSlot}>{viewToggle}{addButton}</TabAction>} />
    );
  };

  // 목록은 보기 전환과 함께 자기 조작을 그린다.
  const listShown = !unknown && !targetId && several;

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 열린 채로 처음부터 다시 그려진다.
  return (
    <>
      {content()}
      {!unknown && monitors.length > 0 && !listShown && (
        <TabAction slot={actionSlot}>{current && several && !leaving && <TabBackLink label="모니터 목록" to={listPath} />}{addButton}</TabAction>
      )}
      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={create} />}
      {moving && <MoveTargetDialog kind="monitor" targetName={moving.name} currentServerId={serverId}
        onClose={closeMove} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}
