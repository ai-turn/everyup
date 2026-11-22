import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { api } from '../../../services/api';
import { InfrastructurePanel } from '../../infra/components/InfrastructurePanel';
import { InfrastructureCollectorSetupDialog } from '../../infrastructure/components/InfrastructureCollectorSetupDialog';
import { connectAction } from '../../connections/connectCopy';
import { serverPath } from '../serverPaths';
import { infrastructurePanelStatus, type ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt, PanelPlaceholder } from './ConnectPrompt';
import { MOVE_TARGET_UNCERTAIN, useLeavingTarget, useMoveTarget } from '../useMoveTarget';
import { readLatest, TargetGoneError } from '../../../utils/readLatest';
import { MoveTargetDialog } from './MoveTargetDialog';

/** 인프라 탭: 서버마다 리소스가 하나뿐이라 없으면 연결 안내, 있으면 그 상세다. 추가할 것이 없어 탭 줄의 조작 자리는 비어 있다. */
export function ServerInfrastructureTab({ row, onChanged, unknown, stale, onRetry, refreshToken, forgetTarget }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // 설정 안내의 "인프라 보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  // 대화 상자가 리소스를 만들었다(키를 발급했다). 만들지 않고 닫으면 다시 불러올 것이 없다.
  const issued = useRef(false);
  const serverId = row.server.id;
  const resource = row.targets.infrastructure;
  const { leaving, leave, mounted } = useLeavingTarget();
  const { moving, open: startMove, close: closeMove, markMoved } = useMoveTarget((id) => resource?.id === id ? resource : undefined, Boolean(unknown || stale));
  const firstScreen = serverPath(serverId, 'infrastructure');
  // ServerDetailPage가 이 표시를 보고 포커스를 탭 패널로 옮긴다.
  const show = (path: string) => navigate(path, { state: { focusPanel: true } });

  const openSetup = () => { created.current = false; issued.current = false; setAdding(true); };

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫는다. 먼저 닫으면 잠시 연결 안내가 다시 보인다.
  const finishCreate = async () => {
    if (created.current) return;
    created.current = true;
    await onChanged();
    setAdding(false);
    toast.success('인프라 리소스를 추가했습니다');
    if (mounted.current) show(firstScreen);
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(false);
    // 만든 뒤 닫기(X)로 닫았으면 새 리소스를 불러온다.
    if (issued.current) void onChanged();
  };

  const move = async (id: string, to: string) => {
    const latest = row.targets.infrastructure;
    if (latest?.id !== id) throw new Error(unknown || stale ? MOVE_TARGET_UNCERTAIN : '이 인프라 리소스가 이 서버에 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    // serverId를 빼면 백엔드가 옛 화면의 요청으로 보고 서버의 그룹을 바꾼다.
    const current = await readLatest(() => api.getInfrastructureResource(latest.id), '이동').catch(async (cause: unknown) => {
      // 이미 지워졌으면 화면에서도 뺀다(대화 상자는 대상이 사라진 것을 보고 닫힌다).
      if (cause instanceof TargetGoneError) { forgetTarget?.('infrastructure', latest.id); void onChanged(); }
      throw cause;
    });
    const updated = await api.updateInfrastructureResource(current.id, { name: current.name, serverId: to });
    markMoved();
    leave();
    // 다시 불러오기가 실패해도 옮긴 리소스가 이 서버에 남지 않게 한다.
    forgetTarget?.('infrastructure', current.id, updated);
    await onChanged();
    closeMove();
    toast.success('인프라 리소스를 옮겼습니다');
    if (mounted.current) show(serverPath(to, 'infrastructure'));
  };

  // 다시 불러오기가 실패해도 지운 리소스가 이전 목록에 남지 않게 먼저 뺀다. 화면을 옮길 때까지 자리 표시를 둔다.
  const removed = async (id: string) => {
    leave();
    forgetTarget?.('infrastructure', id);
    await onChanged();
    if (mounted.current) show(firstScreen);
  };

  const content = () => {
    if (leaving) return <PanelPlaceholder />;
    if (unknown) return <LoadErrorBanner inline title="인프라 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (!resource) {
      return (
        <ConnectPrompt title="이 서버의 인프라를 연결하세요"
          description="CPU, 메모리, 디스크를 수집합니다. 서버에 OpenTelemetry Collector를 설치해야 합니다. 연결을 누르면 API Key와 그 Collector의 설정 파일을 받습니다. 키는 한 번만 표시됩니다.">
          <Button onClick={openSetup}><MaterialIcon name="add" />{connectAction('infrastructure')}</Button>
        </ConnectPrompt>
      );
    }
    return (
      <InfrastructurePanel key={resource.id} resource={resource} status={infrastructurePanelStatus(resource, Boolean(stale))} serverName={row.server.name} refreshToken={refreshToken}
        onChanged={onChanged} onDeleted={() => void removed(resource.id)}
        menuItems={[{ label: '다른 서버로 옮기기', icon: 'arrow_forward', onSelect: () => startMove(resource.id) }]} />
    );
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 한 번만 보이는 키가 사라진다.
  return (
    <>
      {content()}
      {adding && <InfrastructureCollectorSetupDialog serverId={serverId} serverName={row.server.name} onClose={closeSetup}
        onIssued={() => { issued.current = true; }} onCreated={() => void finishCreate()} />}
      {moving && <MoveTargetDialog kind="infrastructure" targetName={moving.name} currentServerId={serverId}
        onClose={closeMove} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}
