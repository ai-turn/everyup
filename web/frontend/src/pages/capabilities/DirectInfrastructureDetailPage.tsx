import { useNavigate, useParams } from 'react-router-dom';
import { InfrastructurePanel } from '../../features/infra/components/InfrastructurePanel';

// 옛 인프라 상세(/infrastructure/:resourceId). 본문은 InfrastructurePanel이 맡고, 이 파일은 Task 13에서 삭제한다.
export function DirectInfrastructureDetailPage() {
  const { resourceId = '' } = useParams();
  const navigate = useNavigate();
  // 리소스가 바뀌면 이전 리소스의 늦은 응답이 남지 않도록 새로 그린다.
  return <InfrastructurePanel key={resourceId} resourceId={resourceId} standalone back={{ label: '인프라', to: '/infrastructure' }}
    onDeleted={() => navigate('/infrastructure', { replace: true })} />;
}
