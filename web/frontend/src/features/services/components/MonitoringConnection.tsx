import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, MaterialIcon } from '../../../components/common';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';
import { InfrastructureCollectorSetupDialog } from '../../infrastructure/components/InfrastructureCollectorSetupDialog';

type Capability = 'logs' | 'api' | 'metrics' | 'infrastructure';
const labels: Record<Capability, string> = { logs: '로그', api: 'API', metrics: '메트릭', infrastructure: '인프라' };

// 메뉴는 직접 설정만 연다 — Docker 환경 선택과 수집 프로필 변경은 Docker 환경 화면에 있다(ADR 0007).
// 설정 대화상자를 바로 연다. 앞에 있던 "기존 대상 / 새 대상" 선택 창은 이미 수신 중인 대상을
// 다시 확인할 뿐이었다 — 수집 상태는 목록과 상세에 있다.
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
      ? <InfrastructureCollectorSetupDialog onClose={close} onCreated={resource => view(resource.id)} />
      : <DirectTelemetrySetupDialog signal={capability === 'api' ? 'traces' : capability} capabilityLabel={label} title={`${label} 직접 연결`} description="앱의 OpenTelemetry 데이터를 EveryUp에 연결합니다." onClose={close} onCreated={service => view(service.id)} />)}
  </>;
}
