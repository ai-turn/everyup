import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, MaterialIcon, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { api, type ObservedService, type TelemetrySignal } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { InfrastructureCollectorSetupDialog } from '../../infrastructure/components/InfrastructureCollectorSetupDialog';
import { TelemetryReceiptStatus } from './TelemetryReceiptStatus';

type Capability = 'logs' | 'api' | 'metrics' | 'infrastructure';
const labels: Record<Capability, string> = { logs: '로그', api: 'API', metrics: '메트릭', infrastructure: '인프라' };
type Target = { id: string; label: string; direct?: ObservedService; infrastructureId?: string };

// 메뉴는 직접 설정만 연다 — Docker 환경 선택과 수집 프로필 변경은 Docker 환경 화면에 있다(ADR 0007).
export function MonitoringConnection({ capability, onConnected }: { capability: Capability; onConnected?: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)}><MaterialIcon name="add" />{labels[capability]} 연결</Button>
    {open && <ConnectionFlow capability={capability} onClose={() => setOpen(false)} onConnected={onConnected} />}
  </>;
}

function ConnectionFlow({ capability, onClose, onConnected }: { capability: Capability; onClose: () => void; onConnected?: () => void }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'choose' | 'direct' | 'receipt'>('choose');
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const selected = targets.find(target => target.id === selectedId);
  const signal: TelemetrySignal = capability === 'api' ? 'traces' : capability === 'infrastructure' ? 'metrics' : capability;
  const label = labels[capability];
  useEffect(() => {
    if (mode === 'choose' || mode === 'receipt') ref.current?.showModal();
  }, [mode]);
  useEffect(() => {
    let active = true;
    Promise.all([capability === 'infrastructure' ? Promise.resolve([]) : api.getObservedServices(), capability === 'infrastructure' ? api.getInfrastructureResources() : Promise.resolve([])])
      .then(([direct, infrastructure]) => {
        if (!active) return;
        const rows: Target[] = [];
        for (const service of direct ?? []) if (service.isActive) rows.push({ id: `direct:${service.id}`, label: `${service.name} · 직접 연결`, direct: service });
        for (const resource of infrastructure ?? []) if (resource.adapter === 'otel-collector' && resource.isActive) rows.push({ id: `infra:${resource.id}`, label: `${resource.name} · Collector`, infrastructureId: resource.id });
        setTargets(rows);
        setSelectedId(rows[0]?.id ?? '');
      }).catch(error => { if (active) setError(getErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [capability]);

  const viewDirect = (id: string) => { onConnected?.(); onClose(); navigate(`/${capability}/${id}`); };
  const next = () => {
    if (selected?.direct?.signals.includes(signal) || selected?.infrastructureId) setMode('receipt');
    else setMode('direct');
  };

  if (mode === 'direct') return capability === 'infrastructure'
    ? <InfrastructureCollectorSetupDialog onClose={onClose} onCreated={resource => viewDirect(resource.id)} />
    : <DirectTelemetrySetupDialog initialService={selected?.direct} signal={signal} capabilityLabel={label} title={`${label} 직접 연결`} description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다." onClose={onClose} onCreated={service => viewDirect(service.id)} />;
  return <dialog ref={ref} aria-label={`${label} 연결`} onCancel={event => { event.preventDefault(); onClose(); }} className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface p-6 ${SCRIM_MODAL_DIALOG}`}>
    <div className="flex items-start justify-between gap-3">
      <h2 className="type-card-title text-text-base">{label} 연결</h2>
      <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} />
    </div>
    {mode === 'receipt' && selected ? <div className="mt-4 space-y-4">
      <p className="type-body text-text-secondary">{selected.label}의 기존 연결을 사용합니다.</p>
      <TelemetryReceiptStatus path={selected.infrastructureId ? `/infrastructure-resources/${selected.infrastructureId}/setup-status` : `/observed-services/${selected.direct!.id}/setup-status`} expected={[capability === 'infrastructure' ? 'infrastructure' : signal]} />
      <Button onClick={() => viewDirect(selected.infrastructureId ?? selected.direct!.id)}>{label} 보기</Button>
    </div> : <div className="mt-4 space-y-5">
      <p className="type-body text-text-muted">이미 등록된 대상을 사용하거나 새 대상을 연결하세요.</p>
      {error && <p role="alert" className="type-body text-status-error">{error}</p>}
      {loading ? <p className="type-body text-text-muted">기존 대상 확인 중…</p> : targets.length > 0 ? <div className="space-y-3">
        <Select aria-label="기존 모니터링 대상" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</Select>
        <Button onClick={next}>기존 대상 연결 확인</Button>
      </div> : <p className="type-body text-text-muted">등록된 대상이 없습니다.</p>}
      <div className="space-y-3 border-t border-ui-border pt-4">
        <p className="type-label text-text-base">새로운 대상</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setSelectedId(''); setMode('direct'); }}>{capability === 'infrastructure' ? '표준 Collector 연결' : 'OpenTelemetry로 직접 연결'}</Button>
        </div>
      </div>
    </div>}
    <div className="mt-5 flex justify-end"><Button variant="quiet" onClick={onClose}>닫기</Button></div>
  </dialog>;
}
