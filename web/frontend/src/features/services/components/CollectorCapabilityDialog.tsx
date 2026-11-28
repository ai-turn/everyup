import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { api, type AgentCollectionCapability, type ConnectedAgent } from '../../../services/api';
import type { CollectorSetupStatus } from '../../../services/api/agents';
import { getErrorMessage } from '../../../utils/errors';
import { useSetupStatus } from '../useSetupStatus';
import { ApplyScope } from '../../connections/ApplyScope';
import { APPLY_SCOPE, DOCKER_CAPABILITY_NAME } from '../../connections/connectCopy';
import { ReceiptPanel } from './TelemetryReceiptStatus';
import { useActiveOtelInfrastructure } from '../../servers/useInfrastructureSources';

const labels: Record<AgentCollectionCapability, string> = DOCKER_CAPABILITY_NAME;

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
  // 서버당 호스트 지표 출처는 하나다(ADR 0012). 이 서버에 OpenTelemetry Collector 인프라가 있으면 인프라를 더하는 것이 출처를 바꾸는 일이다.
  const otelInfrastructure = useActiveOtelInfrastructure(capability === 'infrastructure' ? agent.serverId : undefined) === true;
  useEffect(() => { ref.current?.showModal(); }, []);
  const apply = async () => {
    setSaving(true);
    try {
      const current = await api.getCollectorSetupStatus(agent.id);
      if (!current.profile.capabilities.includes(capability)) {
        await api.updateAgentProfile(agent.id, { kind: 'custom', capabilities: [...current.profile.capabilities, capability] }, otelInfrastructure ? 'docker' : undefined);
      }
      onApply();
    } catch (error) { toast.error(getErrorMessage(error)); }
    finally { setSaving(false); }
  };
  return <dialog ref={ref} aria-labelledby="collector-capability-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6 ${SCRIM_MODAL_DIALOG}`}>
    <h2 id="collector-capability-title" className="type-card-title text-text">{labels[capability]} 연결</h2>
    <p className="mt-2 type-body text-text-muted">{agent.name}의 Docker Collector에 기능을 더합니다. ID·키·수집 이력이 유지됩니다.</p>
    <div className="mt-4 space-y-label">
      <ApplyScope>{APPLY_SCOPE.dockerCapability}</ApplyScope>
      {otelInfrastructure && (
        <p className="type-body text-text">이 서버는 OpenTelemetry Collector로 호스트 지표를 받고 있습니다. 서버의 호스트 지표 출처는 하나라, Docker Collector에 인프라를 더하면 OpenTelemetry Collector 연결을 중지합니다(수집한 기록은 남습니다). 그대로 두려면 닫으세요.</p>
      )}
      <CapabilityStatus status={status} statusError={statusError} capability={capability} saving={saving} onApply={() => void apply()}
        applyLabel={otelInfrastructure ? 'Docker Collector로 바꾸고 적용 명령 받기' : undefined} />
    </div>
    <div className="mt-5 flex justify-end border-t border-border pt-4">
      <Button variant="quiet" onClick={onClose} disabled={saving}>닫기</Button>
    </div>
  </dialog>;
}

/** 수집 설정을 불러온 결과에 따라: 오류, 확인 중, 이미 선택된 기능(수신 기록), 아직 고르지 않은 기능. 적용 명령은 설정이 다 맞기 전까지 받을 수 있다. */
function CapabilityStatus({ status, statusError, capability, saving, onApply, applyLabel = '적용 명령 받기' }: {
  status: CollectorSetupStatus | null | undefined;
  statusError: string | null | undefined;
  capability: AgentCollectionCapability;
  saving: boolean;
  onApply: () => void;
  applyLabel?: string;
}) {
  if (statusError) return <p role="alert" className="type-body text-attn-text">{statusError}</p>;
  if (!status) return <p className="type-body text-text-muted">수집 설정 확인 중…</p>;
  const enabled = status.profile.capabilities.includes(capability);
  return <>
    <p className="type-body text-text-muted">{status.connected ? '최근 Docker Collector 통신 확인됨' : '최근 Docker Collector 통신 없음'} · 현재 선택: {status.profile.capabilities.map(item => labels[item]).join(', ')}</p>
    {enabled ? <>
      <p className="type-body text-text">이미 선택된 기능입니다. 데이터 수신 기록을 확인하세요.</p>
      <ReceiptPanel signals={status.signals} expected={[capability === 'api' ? 'traces' : capability]} />
    </> : (capability === 'api' ? <p className="type-body text-text-muted">API 요청 수집은 eBPF Observer와 호스트 권한을 추가합니다.</p> : null)}
    {(!enabled || !status.configApplied || !status.connected) && <Button onClick={onApply} loading={saving}>{enabled ? '적용 명령 받기' : applyLabel}</Button>}
  </>;
}
