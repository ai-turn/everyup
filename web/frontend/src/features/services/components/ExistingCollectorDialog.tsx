import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Select } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { api, type AgentCollectionCapability, type ConnectedAgent } from '../../../services/api';
import type { CollectorSetupStatus } from '../../../services/api/agents';
import { getErrorMessage } from '../../../utils/errors';
import { useSetupStatus } from '../useSetupStatus';
import { ReceiptPanel } from './TelemetryReceiptStatus';

const labels: Record<AgentCollectionCapability, string> = { uptime: '컨테이너 상태', logs: '로그', infrastructure: '인프라', api: 'API 추적', metrics: '메트릭' };

export function ExistingCollectorDialog({ capability, initialAgentId, onView, onClose, onNew, onInstall }: {
  initialAgentId?: string;
  onView?: (agent: ConnectedAgent) => void;
  capability: AgentCollectionCapability;
  onClose: () => void;
  onNew: () => void;
  onInstall: (agent: ConnectedAgent) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = agents.find(agent => agent.id === selectedId);
  const { data: status, error: statusError } = useSetupStatus<CollectorSetupStatus>(selectedId ? `/agents/${selectedId}/setup-status` : null);
  const enabled = status?.profile.capabilities.includes(capability);
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    api.getAgents().then(rows => {
      if (active) { setAgents(rows ?? []); setSelectedId(initialAgentId ?? rows?.[0]?.id ?? ''); }
    }).catch(error => { if (active) setError(getErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialAgentId]);
  const apply = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const current = await api.getCollectorSetupStatus(selected.id);
      if (!current.profile.capabilities.includes(capability)) {
        await api.updateAgentProfile(selected.id, { kind: 'custom', capabilities: [...current.profile.capabilities, capability] });
      }
      onInstall(selected);
    } catch (error) { toast.error(getErrorMessage(error)); }
    finally { setSaving(false); }
  };
  return <dialog ref={ref} aria-labelledby="existing-collector-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface p-6 ${SCRIM_MODAL_DIALOG}`}>
    <h2 id="existing-collector-title" className="type-card-title text-text-base">{labels[capability]} Docker 연결</h2>
    <p className="mt-2 text-sm text-text-muted">같은 서버에 수집기가 있다면 기존 연결을 사용하세요. ID·키·수집 이력이 유지됩니다.</p>
    {error && <p role="alert" className="mt-3 text-sm text-status-error">{error}</p>}
    {loading ? <p className="mt-4 text-sm text-text-muted">기존 Docker 환경 확인 중...</p> : agents.length > 0 ? <div className="mt-4 space-y-3">
      <label className="block space-y-1.5 text-sm text-text-secondary">사용할 Docker 환경
        <Select aria-label="사용할 Docker 환경" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={saving}>
          {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </Select>
      </label>
      {statusError ? <p role="alert" className="text-sm text-status-warn">{statusError}</p> : status ? <>
        <p className="text-sm text-text-muted">{status.connected ? '최근 수집기 통신 확인됨' : '최근 수집기 통신 없음'} · 현재 선택: {status.profile.capabilities.map(item => labels[item]).join(', ')}</p>
        {enabled ? <>
          <p className="text-sm text-text-secondary">이미 선택된 기능입니다. 데이터 수신 기록을 확인하세요.</p>
          <ReceiptPanel signals={status.signals} expected={[capability === 'api' ? 'traces' : capability]} />
          {onView && selected && <Button onClick={() => onView(selected)}>{labels[capability]} 보기</Button>}
        </> : <p className="text-sm text-text-muted">이 Docker 환경 전체에 기능을 추가합니다. 적용 명령을 서버에서 실행해야 하며, API 추적은 eBPF Observer와 호스트 권한을 추가합니다. 앱 재시작은 필요하지 않습니다.</p>}
        {(!enabled || !status.configApplied || !status.connected) && <Button onClick={() => void apply()} loading={saving}>{enabled ? '설정 적용 명령' : `${labels[capability]} 추가 및 적용 명령`}</Button>}
      </> : <p className="text-sm text-text-muted">수집 설정 확인 중...</p>}
    </div> : <p className="mt-4 text-sm text-text-muted">등록된 Docker 환경이 없습니다.</p>}
    <div className="mt-5 flex justify-end gap-2 border-t border-ui-border pt-4">
      <Button variant="quiet" onClick={onClose} disabled={saving}>닫기</Button>
      <Button variant="secondary" onClick={onNew} disabled={saving}>새 Docker 환경</Button>
    </div>
  </dialog>;
}
