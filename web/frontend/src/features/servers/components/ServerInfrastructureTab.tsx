import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { api } from '../../../services/api';
import { InfrastructurePanel } from '../../infra/components/InfrastructurePanel';
import { InfrastructureCollectorSetupDialog } from '../../infrastructure/components/InfrastructureCollectorSetupDialog';
import { serverPath } from '../serverPaths';
import type { ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt } from './ConnectPrompt';
import { MoveTargetDialog } from './MoveTargetDialog';

/** 인프라 탭: 서버마다 리소스가 하나뿐이라 없으면 연결 안내, 있으면 그 상세다. */
export function ServerInfrastructureTab({ row, targetId, onChanged, unknown, onRetry, refreshToken }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // 설정 안내의 "인프라 보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  // ID만 둔다. 옮길 때 최신 행에서 찾아야 그 사이의 변경을 되돌리지 않는다.
  const [movingId, setMovingId] = useState<string | null>(null);
  const serverId = row.server.id;
  const resource = row.targets.infrastructure;
  const firstScreen = serverPath(serverId, 'infrastructure');
  // ServerDetailPage가 이 표시를 보고 포커스를 탭 패널로 옮긴다.
  const show = (path: string) => navigate(path, { state: { focusPanel: true } });

  // 리소스는 하나라 대상 주소가 없다.
  useEffect(() => {
    if (targetId) navigate(firstScreen, { replace: true });
  }, [targetId, firstScreen, navigate]);

  const openSetup = () => { created.current = false; setAdding(true); };

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫는다. 먼저 닫으면 잠시 연결 안내가 다시 보인다.
  const finishCreate = async () => {
    if (created.current) return;
    created.current = true;
    await onChanged();
    setAdding(false);
    toast.success('인프라 리소스를 추가했습니다');
    show(firstScreen);
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(false);
    // 만든 뒤 닫기(X)로 닫았을 수도 있다.
    void onChanged();
  };

  const move = async (id: string, to: string) => {
    const latest = row.targets.infrastructure;
    if (latest?.id !== id) throw new Error('이 인프라 리소스가 이 서버에 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    // serverId를 빼면 백엔드가 옛 화면의 요청으로 보고 서버의 그룹을 바꾼다.
    await api.updateInfrastructureResource(latest.id, { name: latest.name, serverId: to });
    await onChanged();
    setMovingId(null);
    toast.success('인프라 리소스를 옮겼습니다');
    show(serverPath(to, 'infrastructure'));
  };

  const removed = async () => {
    await onChanged();
    show(firstScreen);
  };

  const moving = movingId && resource?.id === movingId ? resource : undefined;

  const content = () => {
    if (unknown) return <LoadErrorBanner inline title="인프라 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (!resource) {
      return (
        <ConnectPrompt title="이 서버의 인프라를 연결하세요" description="CPU, 메모리, 디스크를 수집합니다. 서버에 OpenTelemetry Collector를 설치해야 합니다.">
          <Button onClick={openSetup}><MaterialIcon name="add" />인프라 연결</Button>
        </ConnectPrompt>
      );
    }
    return (
      <InfrastructurePanel key={resource.id} resourceId={resource.id} resource={resource} hideGroup refreshToken={refreshToken}
        back={{ label: '개요', to: serverPath(serverId) }} onChanged={onChanged} onDeleted={() => void removed()}
        extraActions={<Button collapseLabel variant="secondary" onClick={() => setMovingId(resource.id)}><MaterialIcon name="arrow_forward" />다른 서버로 옮기기</Button>} />
    );
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 한 번만 보이는 키가 사라진다.
  return (
    <>
      {content()}
      {adding && <InfrastructureCollectorSetupDialog serverId={serverId} onClose={closeSetup} onCreated={() => void finishCreate()} />}
      {moving && <MoveTargetDialog kind="infrastructure" targetName={moving.name} currentServerId={serverId}
        onClose={() => setMovingId(null)} onMove={(to) => move(moving.id, to)} />}
    </>
  );
}
