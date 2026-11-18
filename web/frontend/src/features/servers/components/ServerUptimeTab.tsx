import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { UptimeMonitorDialog } from '../../uptime/components/UptimeMonitorDialog';
import { UptimeMonitorList } from '../../uptime/components/UptimeMonitorList';
import { UptimeMonitorPanel } from '../../uptime/components/UptimeMonitorPanel';
import { monitorInput } from '../../uptime/monitorInput';
import { api, type UptimeMonitorInput } from '../../../services/api';
import { serverPath } from '../serverPaths';
import type { ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt } from './ConnectPrompt';
import { MoveTargetDialog } from './MoveTargetDialog';

/** 업타임 탭: 모니터가 없으면 연결 안내, 하나면 그 상세, 여럿이면 목록. 주소에 모니터가 있으면 그 상세. */
export function ServerUptimeTab({ row, targetId, onChanged, unknown, stale, onRetry, refreshToken }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // ID만 둔다. 옮길 때 최신 행에서 찾아야 그 사이의 일시정지나 수정을 되돌리지 않는다.
  const [movingId, setMovingId] = useState<string | null>(null);
  const serverId = row.server.id;
  const monitors = row.targets.monitors;
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
    await onChanged();
    setMovingId(null);
    toast.success('업타임 모니터를 옮겼습니다');
    show(serverPath(to, 'uptime', monitor.id));
  };

  const removed = async () => {
    await onChanged();
    show(firstScreen);
  };

  const moving = movingId ? monitors.find((monitor) => monitor.id === movingId) : undefined;
  const current = targetId ? monitors.find((monitor) => monitor.id === targetId) : monitors.length === 1 ? monitors[0] : undefined;
  const addButton = <Button variant="secondary" onClick={() => setAdding(true)}><MaterialIcon name="add" />모니터 추가</Button>;

  const content = () => {
    if (unknown) return <LoadErrorBanner inline title="업타임 모니터 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (targetId && !current) {
      // 다시 불러오지 못해 이전 정보만 있으면 "이 서버의 것이 아니다"라고 단정하지 않는다.
      if (stale) return <LoadErrorBanner inline title="이 모니터의 정보를 불러오지 못했습니다" onRetry={onRetry} />;
      return (
        <EmptyState icon="search_off" title="이 서버의 모니터가 아닙니다" description="다른 서버로 옮겨졌거나 삭제되었습니다." headingLevel="h2">
          <ButtonLink variant="secondary" to={firstScreen}>이 서버의 모니터 보기</ButtonLink>
        </EmptyState>
      );
    }
    if (monitors.length === 0) {
      return (
        <ConnectPrompt title="이 서버의 업타임 모니터를 추가하세요" description="확인할 URL이나 호스트와 포트만 입력하면 됩니다. 서버에 설치할 것은 없습니다.">
          <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />업타임 모니터 추가</Button>
        </ConnectPrompt>
      );
    }
    if (current) {
      return (
        <div className="space-y-5">
          {!targetId && <div className="flex justify-end">{addButton}</div>}
          <UptimeMonitorPanel key={current.id} monitorId={current.id} back={{ label: '목록', to: firstScreen, showBack: monitors.length > 1 }}
            onDeleted={() => void removed()} onChanged={onChanged} refreshToken={refreshToken}
            extraActions={<Button collapseLabel variant="secondary" onClick={() => setMovingId(current.id)}><MaterialIcon name="arrow_forward" />다른 서버로 옮기기</Button>} />
        </div>
      );
    }
    // 목록은 서버 상세가 불러온 모니터를 쓴다. 갱신의 주체는 서버 상세 하나다.
    return (
      <UptimeMonitorList monitors={monitors} filter={(monitor) => monitor.serverId === serverId}
        hrefFor={(monitor) => serverPath(serverId, 'uptime', monitor.id)} createDefaults={{ serverId }} onChanged={onChanged}
        renderControls={({ viewToggle }) => <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{viewToggle}{addButton}</div>} />
    );
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 열린 채로 처음부터 다시 그려진다.
  return (
    <>
      {content()}
      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={create} />}
      {moving && <MoveTargetDialog kind="monitor" targetName={moving.name} currentServerId={serverId}
        onClose={() => setMovingId(null)} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}
