import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { api, type AgentCollectionCapability, type ConnectedAgent } from '../../../services/api';
import type { CollectorSetupStatus } from '../../../services/api/agents';
import { getErrorMessage } from '../../../utils/errors';
import { useSetupStatus } from '../useSetupStatus';
import { ReceiptPanel } from './TelemetryReceiptStatus';

const labels: Record<AgentCollectionCapability, string> = { uptime: '컨테이너 상태', logs: '로그', infrastructure: '인프라', api: 'API 요청', metrics: '메트릭' };

// Docker 환경의 수집 프로필에 기능 하나를 더한다. ID·키·수집 이력은 그대로이고, 적용 명령은 onApply가 연다.
export function CollectorCapabilityDialog({ agent, capability, onClose, onApply }: {
  agent: ConnectedAgent;
  capability: AgentCollectionCapability;
  onClose: () => void;
  onApply: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const { data: status, error: statusError } = useSetupStatus<CollectorSetupStatus>(`/agents/${agent.id}/setup-status`);
  const enabled = status?.profile.capabilities.includes(capability);
  useEffect(() => { ref.current?.showModal(); }, []);
  const apply = async () => {
    setSaving(true);
    try {
      const current = await api.getCollectorSetupStatus(agent.id);
      if (!current.profile.capabilities.includes(capability)) {
        await api.updateAgentProfile(agent.id, { kind: 'custom', capabilities: [...current.profile.capabilities, capability] });
      }
      onApply();
    } catch (error) { toast.error(getErrorMessage(error)); }
    finally { setSaving(false); }
  };
  return <dialog ref={ref} aria-labelledby="collector-capability-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface p-6 ${SCRIM_MODAL_DIALOG}`}>
    <h2 id="collector-capability-title" className="type-card-title text-text-base">{labels[capability]} 수집 추가</h2>
    <p className="mt-2 text-sm text-text-muted">{agent.name}의 기존 Collector에 기능을 더합니다. ID·키·수집 이력이 유지됩니다.</p>
    <div className="mt-4 space-y-3">
      {statusError ? <p role="alert" className="text-sm text-status-warn">{statusError}</p> : status ? <>
        <p className="text-sm text-text-muted">{status.connected ? '최근 Collector 통신 확인됨' : '최근 Collector 통신 없음'} · 현재 선택: {status.profile.capabilities.map(item => labels[item]).join(', ')}</p>
        {enabled ? <>
          <p className="text-sm text-text-secondary">이미 선택된 기능입니다. 데이터 수신 기록을 확인하세요.</p>
          <ReceiptPanel signals={status.signals} expected={[capability === 'api' ? 'traces' : capability]} />
        </> : <p className="text-sm text-text-muted">이 Docker 환경 전체에 기능을 추가합니다. 적용 명령을 서버에서 실행해야 하며, API 요청 수집은 eBPF Observer와 호스트 권한을 추가합니다. 앱 재시작은 필요하지 않습니다.</p>}
        {(!enabled || !status.configApplied || !status.connected) && <Button onClick={() => void apply()} loading={saving}>{enabled ? '설정 적용 명령' : `${labels[capability]} 추가 및 적용 명령`}</Button>}
      </> : <p className="text-sm text-text-muted">수집 설정 확인 중…</p>}
    </div>
    <div className="mt-5 flex justify-end border-t border-ui-border pt-4">
      <Button variant="quiet" onClick={onClose} disabled={saving}>닫기</Button>
    </div>
  </dialog>;
}
