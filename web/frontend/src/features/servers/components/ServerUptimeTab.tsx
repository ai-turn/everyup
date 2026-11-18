import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { UptimeMonitorDialog } from '../../uptime/components/UptimeMonitorDialog';
import { UptimeMonitorList } from '../../uptime/components/UptimeMonitorList';
import { UptimeMonitorPanel } from '../../uptime/components/UptimeMonitorPanel';
import { monitorInput } from '../../uptime/monitorInput';
import { api, type UptimeMonitorInput } from '../../../services/api';
import { CONNECT_LABEL, serverPath } from '../serverPaths';
import type { ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt, TabAction } from './ConnectPrompt';
import { useMoveTarget } from '../useMoveTarget';
import { MoveTargetDialog } from './MoveTargetDialog';
import { TabBackLink } from './TabBackLink';

/** 업타임 탭: 모니터가 없으면 연결 안내, 하나면 그 상세, 여럿이면 목록. 주소에 모니터가 있으면 그 상세. */
export function ServerUptimeTab({ row, targetId, onChanged, unknown, stale, onRetry, refreshToken, actionSlot }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const serverId = row.server.id;
  const monitors = row.targets.monitors;
  const { moving, open: startMove, close: closeMove, markMoved } = useMoveTarget((id) => monitors.find((monitor) => monitor.id === id));
  const firstScreen = serverPath(serverId, 'uptime');
  // ServerDetailPage가 이 표시를 보고 포커스를 탭 패널로 옮긴다.
  const show = (path: string) => navigate(path, { state: { focusPanel: true } });

  // 대화 상자를 먼저 닫는다. 닫힐 때 포커스가 연 버튼으로 돌아가므로, 그 뒤에 화면을 바꿔야 포커스가 패널에 남는다.
  // 서버 데이터를 다시 불러온 뒤에 이동한다. 먼저 이동하면 새 모니터가 아직 이 서버의 것으로 보이지 않는다.
  const create = async (input: UptimeMonitorInput) => {
    const created = await api.createUptimeMonitor({ ...input, serverId });
    await onChanged();
    setAdding(false);
    toast.success('업타임 모니터를 추가했습니다');
    show(serverPath(serverId, 'uptime', created.id));
  };

  const move = async (id: string, to: string) => {
    const monitor = monitors.find((candidate) => candidate.id === id);
    if (!monitor) throw new Error('이 모니터가 이 서버에 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    await api.updateUptimeMonitor(monitor.id, monitorInput(monitor, { serverId: to }));
    markMoved();
    await onChanged();
    closeMove();
    toast.success('업타임 모니터를 옮겼습니다');
    show(serverPath(to, 'uptime', monitor.id));
  };

  const removed = async () => {
    await onChanged();
    show(firstScreen);
  };

  const current = targetId ? monitors.find((monitor) => monitor.id === targetId) : monitors.length === 1 ? monitors[0] : undefined;
  const label = CONNECT_LABEL.uptime;
  const addButton = <Button variant="secondary" onClick={() => setAdding(true)}><MaterialIcon name="add" />{label}</Button>;
  // 모니터가 둘 이상이면 상세에서 목록으로 돌아가는 길을 둔다. 하나면 그 상세가 탭의 첫 화면이다.
  const several = monitors.length > 1;

  const content = () => {
    if (unknown) return <LoadErrorBanner inline title="업타임 모니터 정보를 불러오지 못했습니다" onRetry={onRetry} />;
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
          back={several ? { label: '업타임 탭으로', to: firstScreen } : { label: '서버 개요', to: serverPath(serverId) }}
          listLink={several && <TabBackLink label="모니터 목록" to={firstScreen} />}
          onDeleted={() => void removed()} onChanged={onChanged} refreshToken={refreshToken}
          extraActions={<Button collapseLabel variant="secondary" onClick={() => startMove(current.id)}><MaterialIcon name="arrow_forward" />다른 서버로 옮기기</Button>} />
      );
    }
    // 목록은 서버 상세가 불러온 모니터를 쓴다. 갱신의 주체는 서버 상세 하나다. 보기 전환은 탭 줄의 조작 자리에서 추가 버튼 앞이다.
    return (
      <UptimeMonitorList monitors={monitors} filter={(monitor) => monitor.serverId === serverId} searchLabel="모니터 검색"
        hrefFor={(monitor) => serverPath(serverId, 'uptime', monitor.id)} createDefaults={{ serverId }} onChanged={onChanged}
        renderControls={({ viewToggle }) => <TabAction slot={actionSlot}>{viewToggle}{addButton}</TabAction>} />
    );
  };

  // 목록은 보기 전환과 함께 자기 조작을 그린다.
  const listShown = !unknown && !targetId && several;

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 열린 채로 처음부터 다시 그려진다.
  return (
    <>
      {content()}
      {!unknown && monitors.length > 0 && !listShown && <TabAction slot={actionSlot}>{addButton}</TabAction>}
      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={create} />}
      {moving && <MoveTargetDialog kind="monitor" targetName={moving.name} currentServerId={serverId}
        onClose={closeMove} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}
