import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { UptimeMonitorPanel } from '../../features/uptime/components/UptimeMonitorPanel';
import { useGroupTrail } from '../../hooks/useGroupTrail';
import { listReturnTo } from '../../utils/listReturnTo';

// 옛 업타임 상세(/uptime/:monitorId). 본문은 UptimeMonitorPanel이 맡고, 이 파일은 Task 13에서 삭제한다.
export function UptimeMonitorDetailPage() {
  const { monitorId = '' } = useParams<{ monitorId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // 그룹에서 열었으면 삭제 후에도 그 그룹으로 돌아간다.
  const trail = useGroupTrail();
  const returnTo = trail ? `/projects/${trail.id}` : listReturnTo(location.state, '/uptime');
  // 모니터가 바뀌면 이전 모니터의 늦은 응답이 남지 않도록 새로 그린다.
  return <UptimeMonitorPanel key={monitorId} monitorId={monitorId} standalone back={{ label: '업타임', to: returnTo }} onDeleted={() => navigate(returnTo)} />;
}
