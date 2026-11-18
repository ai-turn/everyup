import { useNavigate, useParams } from 'react-router-dom';
import { DirectMetricsPanel } from '../../features/telemetry/components/DirectMetricsPanel';

// 옛 메트릭 상세(/metrics/:serviceId). 본문은 DirectMetricsPanel이 맡고, 이 파일은 Task 13에서 삭제한다.
export function DirectMetricsDetailPage() {
  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  // 앱이 바뀌면 이전 앱의 늦은 응답이 남지 않도록 새로 그린다.
  return <DirectMetricsPanel key={serviceId} serviceId={serviceId} standalone back={{ label: '메트릭', to: '/metrics' }}
    onRemoved={() => navigate('/metrics', { replace: true })} />;
}
