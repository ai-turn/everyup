import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, MaterialIcon, type OverflowMenuItem } from '../../components/common';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { api, type AgentCollectionCapability, type ConnectedAgent } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { AddServiceModal } from '../services/components/AddServiceModal';
import { ApiKeyModal } from '../services/components/ApiKeyModal';
import { CollectorCapabilityDialog } from '../services/components/CollectorCapabilityDialog';
import { InstrumentationOverrideModal } from '../services/components/InstrumentationOverrideModal';
import { environmentState } from '../services/environmentState';

/**
 * Docker Collector가 있는 서버의 조작과 그 대화 상자(ADR 0012: Docker 환경은 서버다). 옛 Docker 환경 화면의 머리말 조작과 같다.
 * 설치 명령은 설치 전에만 주 조작이고, 그 뒤에는 더보기의 `다시 설치`다(연결 진입점 정리 E6).
 */
export function useDockerActions(agent: ConnectedAgent | undefined, { onChanged, onDeactivated }: {
  /** 키 재발급, 기능 연결, 설치 확인 뒤 서버 데이터를 다시 불러온다. */
  onChanged: () => void;
  /** 비활성화한 뒤. 다른 대상이 없으면 서버도 사라진다. */
  onDeactivated: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  // 설치 명령(처음 설치·다시 설치) 또는 기능을 연결한 뒤의 적용 명령. 같은 대화 상자이고 제목만 다르다.
  const [showInstall, setShowInstall] = useState<'install' | 'apply' | false>(false);
  const [showInstrumentation, setShowInstrumentation] = useState(false);
  const [addingCapability, setAddingCapability] = useState<AgentCollectionCapability | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const installing = agent ? environmentState(agent) === 'install' : false;
  const primary = agent && installing
    ? <Button collapseLabel variant="secondary" onClick={() => setShowInstall('install')}><MaterialIcon name="download" />설치 명령</Button>
    : null;
  const menuItems: OverflowMenuItem[] = agent ? [
    ...(installing ? [] : [{ label: '다시 설치', icon: 'download', onSelect: () => setShowInstall('install') }]),
    { label: 'API Key', icon: 'key', onSelect: () => setShowKey(true) },
    { label: '상세 수집 설정', icon: 'integration_instructions', onSelect: () => setShowInstrumentation(true) },
    { label: 'Docker Collector 비활성화', icon: 'delete_outline', danger: true, onSelect: () => setDeactivating(true) },
  ] : [];

  const deactivate = async () => {
    if (!agent) return;
    try {
      await api.deleteAgent(agent.id);
      toast.success('Docker Collector를 비활성화했습니다');
      onDeactivated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeactivating(false);
    }
  };

  const dialogs = agent && <>
    <ConfirmDialog
      isOpen={deactivating}
      onClose={() => setDeactivating(false)}
      onConfirm={deactivate}
      title="Docker Collector 비활성화"
      message={`'${agent.name}'의 Docker Collector를 비활성화할까요?`}
      description="Docker Collector 연결이 차단되며 수집 데이터는 보존됩니다. 이 서버에 다른 대상이 없으면 서버도 목록에서 사라집니다."
      confirmLabel="비활성화"
    />
    {showKey && <ApiKeyModal agentId={agent.id} agentName={agent.name} onClose={() => setShowKey(false)} onRotated={onChanged} />}
    {showInstall && (
      <AddServiceModal
        existingAgent={{ id: agent.id, name: agent.name }}
        purpose={showInstall}
        onClose={() => setShowInstall(false)}
        onCreated={onChanged}
        onOpenProject={() => setShowInstall(false)}
        onConfigureInstrumentation={() => { setShowInstall(false); setShowInstrumentation(true); }}
      />
    )}
    {addingCapability && (
      <CollectorCapabilityDialog
        agent={agent}
        capability={addingCapability}
        onClose={() => setAddingCapability(null)}
        onApply={() => { setAddingCapability(null); setShowInstall('apply'); onChanged(); }}
      />
    )}
    {showInstrumentation && <InstrumentationOverrideModal agentId={agent.id} onClose={() => setShowInstrumentation(false)} />}
  </>;

  return {
    primary, menuItems, dialogs,
    openInstall: () => setShowInstall('install'),
    openInstrumentation: () => setShowInstrumentation(true),
    addCapability: setAddingCapability,
  };
}
