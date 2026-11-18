import { useNavigate, useParams } from 'react-router-dom';
import { DirectApiPanel } from '../../features/telemetry/components/DirectApiPanel';

// 옛 API 상세(/api/:serviceId). 본문은 DirectApiPanel이 맡고, 이 파일은 Task 13에서 삭제한다.
export function DirectApiDetailPage() {
  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  // 앱이 바뀌면 이전 앱의 늦은 응답이 남지 않도록 새로 그린다.
  return <DirectApiPanel key={serviceId} serviceId={serviceId} standalone back={{ label: 'API', to: '/api' }}
    onRemoved={() => navigate('/api', { replace: true })} />;
}
