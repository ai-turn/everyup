import { useNavigate, useParams } from 'react-router-dom';
import { DirectLogsPanel } from '../../features/telemetry/components/DirectLogsPanel';

// 옛 로그 상세(/logs/:serviceId). 본문은 DirectLogsPanel이 맡고, 이 파일은 Task 13에서 삭제한다.
export function DirectLogsDetailPage() {
  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  // 앱이 바뀌면 이전 앱의 늦은 응답이 남지 않도록 새로 그린다.
  return <DirectLogsPanel key={serviceId} serviceId={serviceId} standalone back={{ label: '로그', to: '/logs' }}
    onRemoved={() => navigate('/logs', { replace: true })} />;
}
