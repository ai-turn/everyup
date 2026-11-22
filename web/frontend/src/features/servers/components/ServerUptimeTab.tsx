import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, LoadErrorBanner, MaterialIcon } from '../../../components/common';
import { UptimeMonitorDialog } from '../../uptime/components/UptimeMonitorDialog';
import { UptimeMonitorList } from '../../uptime/components/UptimeMonitorList';
import { api, type UptimeMonitorInput } from '../../../services/api';
import { connectAction } from '../../connections/connectCopy';
import { ADD_MONITOR_STATE, monitorPath } from '../serverPaths';
import type { ServerCapabilityTabProps } from '../serverStatus';
import { ConnectPrompt, TabAction } from './ConnectPrompt';

/**
 * 업타임 탭: 모니터가 없으면 연결 안내, 있으면 목록(하나여도). 모니터를 누르면 그 모니터의 페이지로 간다(DESIGN.md §4.7 대상 상세).
 * 예전에는 모니터가 하나면 탭의 첫 화면이 그 상세였고, 주소에 모니터가 있으면 탭 안에 상세를 그렸다.
 */
export function ServerUptimeTab({ row, onChanged, unknown, stale, onRetry, actionSlot, forgetTarget }: ServerCapabilityTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const addRequested = (location.state as Record<string, unknown> | null)?.[ADD_MONITOR_STATE] === true;
  const [adding, setAdding] = useState(addRequested);
  // 개요의 첫 버튼이 넘긴 표시는 한 번만 쓴다. 기록에서 지워서 새로고침이나 뒤로 가기로 대화 상자가 다시 열리지 않게 한다.
  useEffect(() => {
    if (addRequested) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [addRequested, location.pathname, location.search, navigate]);
  const serverId = row.server.id;
  const monitors = row.targets.monitors;

  // 서버 데이터를 다시 불러온 뒤에 대화 상자를 닫고 새 모니터의 페이지로 간다. 포커스는 그 페이지의 본문으로 간다.
  const create = async (input: UptimeMonitorInput) => {
    const created = await api.createUptimeMonitor({ ...input, serverId });
    await onChanged();
    setAdding(false);
    toast.success('업타임 모니터를 추가했습니다');
    navigate(monitorPath(serverId, created.id), { state: { focusPanel: true } });
  };

  const label = connectAction('uptime');
  const addButton = <Button variant="secondary" onClick={() => setAdding(true)}><MaterialIcon name="add" />{label}</Button>;

  const content = () => {
    // 이전 목록에 모니터가 없어도 다시 불러오지 못했으면 연결되지 않았다고 단정하지 않는다.
    if (unknown || (stale && monitors.length === 0)) return <LoadErrorBanner inline title="업타임 모니터 정보를 불러오지 못했습니다" onRetry={onRetry} />;
    if (monitors.length === 0) {
      return (
        <ConnectPrompt title="이 서버의 업타임 모니터를 추가하세요" description="확인할 URL이나 호스트와 포트만 입력하면 됩니다. 서버에 설치할 것은 없습니다.">
          <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />{label}</Button>
        </ConnectPrompt>
      );
    }
    // 목록은 서버 상세가 불러온 모니터를 쓴다. 갱신의 주체는 서버 상세 하나다. 보기 전환은 탭 줄의 조작 자리에서 추가 버튼 앞이다.
    return (
      <UptimeMonitorList monitors={monitors} stale={stale} onDeleted={(ids) => ids.forEach((id) => forgetTarget?.('monitors', id))} searchLabel="모니터 검색"
        hrefFor={(monitor) => monitorPath(serverId, monitor.id)} onChanged={onChanged}
        renderControls={({ viewToggle }) => <TabAction slot={actionSlot}>{viewToggle}{addButton}</TabAction>} />
    );
  };

  // 대화 상자는 본문이 바뀌어도 같은 자리에 둔다. 자리가 바뀌면 다시 마운트되어 열린 채로 처음부터 다시 그려진다.
  return (
    <>
      {content()}
      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={create} />}
    </>
  );
}
