import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, MaterialIcon, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { InfrastructureCollectorSetupDialog } from '../../infrastructure/components/InfrastructureCollectorSetupDialog';
import { TelemetryReceiptStatus } from './TelemetryReceiptStatus';

type Capability = 'logs' | 'api' | 'metrics' | 'infrastructure';
const labels: Record<Capability, string> = { logs: '로그', api: 'API', metrics: '메트릭', infrastructure: '인프라' };

// 메뉴는 직접 설정만 연다 — Docker 환경 선택과 수집 프로필 변경은 Docker 환경 화면에 있다(ADR 0007).
// 로그·API·메트릭은 설정 대화상자를 바로 연다. 앞에 있던 "기존 대상 / 새 대상" 선택 창은
// 설정 대화상자의 새 서비스 / 기존 서비스와 같은 질문을 한 번 더 했다.
export function MonitoringConnection({ capability, onConnected }: { capability: Capability; onConnected?: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const label = labels[capability];
  // 닫을 때마다 다시 불러온다 — 만든 뒤 X로 닫으면 새로고침 전까지 목록에 없었다.
  const close = () => { setOpen(false); onConnected?.(); };
  const view = (id: string) => navigate(`/${capability}/${id}`);
  return <>
    <Button onClick={() => setOpen(true)}><MaterialIcon name="add" />{label} 연결</Button>
    {open && (capability === 'infrastructure'
      ? <CollectorConnectionFlow onClose={close} onView={view} />
      : <DirectTelemetrySetupDialog signal={capability === 'api' ? 'traces' : capability} capabilityLabel={label} title={`${label} 직접 연결`} description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다." onClose={close} onCreated={service => view(service.id)} />)}
  </>;
}

function CollectorConnectionFlow({ onClose, onView }: { onClose: () => void; onView: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'choose' | 'setup' | 'receipt'>('choose');
  const [targets, setTargets] = useState<{ id: string; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const selected = targets.find(target => target.id === selectedId);
  useEffect(() => {
    if (mode !== 'setup') ref.current?.showModal();
  }, [mode]);
  useEffect(() => {
    let active = true;
    api.getInfrastructureResources()
      .then(resources => {
        if (!active) return;
        const rows = (resources ?? [])
          .filter(resource => resource.adapter === 'otel-collector' && resource.isActive)
          .map(resource => ({ id: resource.id, label: `${resource.name} · Collector` }));
        setTargets(rows);
        setSelectedId(rows[0]?.id ?? '');
      }).catch(error => { if (active) setError(getErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const view = (id: string) => { onClose(); onView(id); };

  if (mode === 'setup') return <InfrastructureCollectorSetupDialog onClose={onClose} onCreated={resource => view(resource.id)} />;
  return <dialog ref={ref} aria-label="인프라 연결" onCancel={event => { event.preventDefault(); onClose(); }} className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface p-6 ${SCRIM_MODAL_DIALOG}`}>
    <div className="flex items-start justify-between gap-3">
      <h2 className="type-card-title text-text-base">인프라 연결</h2>
      <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} />
    </div>
    {mode === 'receipt' && selected ? <div className="mt-4 space-y-4">
      <p className="type-body text-text-secondary">{selected.label}의 기존 연결을 사용합니다.</p>
      <TelemetryReceiptStatus path={`/infrastructure-resources/${selected.id}/setup-status`} expected={['infrastructure']} />
      <Button onClick={() => view(selected.id)}>인프라 보기</Button>
    </div> : <div className="mt-4 space-y-5">
      <p className="type-body text-text-muted">이미 등록된 대상을 사용하거나 새 대상을 연결하세요.</p>
      {error && <p role="alert" className="type-body text-status-error">{error}</p>}
      {loading ? <p className="type-body text-text-muted">기존 대상 확인 중…</p> : targets.length > 0 ? <div className="space-y-3">
        <Select aria-label="기존 모니터링 대상" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</Select>
        <Button onClick={() => setMode('receipt')}>기존 대상 연결 확인</Button>
      </div> : <p className="type-body text-text-muted">등록된 대상이 없습니다.</p>}
      <div className="space-y-3 border-t border-ui-border pt-4">
        <p className="type-label text-text-base">새로운 대상</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setMode('setup')}>표준 Collector 연결</Button>
        </div>
      </div>
    </div>}
    <div className="mt-5 flex justify-end"><Button variant="quiet" onClick={onClose}>닫기</Button></div>
  </dialog>;
}
