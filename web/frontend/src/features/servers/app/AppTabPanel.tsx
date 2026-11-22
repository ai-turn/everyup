import { useEffect, useState } from 'react';
import { Button, EmptyState, MaterialIcon, type CollectionStatus, type GlobalTimeRange } from '../../../components/common';
import type { ObservedService } from '../../../services/api';
import { ApiExclusionsSettings } from '../../api-requests/ApiExclusionsSettings';
import { useRequestWindow } from '../../api-requests/useRequestQuery';
import { SIGNAL_TARGET, connectAction, connectObject } from '../../connections/connectCopy';
import { DirectServiceLogsTab } from '../../healthcheck/components/AgentServiceLogsTab';
import { DirectServiceMetricsTab } from '../../healthcheck/components/AgentServiceMetricsTab';
import { DirectServiceRequestsTab } from '../../healthcheck/components/AgentServiceRequestsTab';
import { DirectServiceTracesTab } from '../../healthcheck/components/AgentServiceTracesTab';
import { useMetricHealth } from '../../metrics/useMetricHealth';
import { api } from '../../../services/api';
import { receiptCollection } from '../../telemetry/signals';
import { ConnectPrompt } from '../components/ConnectPrompt';
import type { AppTabItem } from './appTabs';

interface PanelProps { app: ObservedService; range: GlobalTimeRange; token: number; traceId?: string; onRotateKey: () => void; onChanged: () => Promise<void> }

/** 열린 탭의 본문. 앱이 그 데이터 유형을 받지 않으면 연결 안내(이 앱에 더하기)이고, 받으면 데이터 화면이다. */
export function AppTabBody({ tab, connected, onConnect, ...panel }: PanelProps & { tab: AppTabItem; connected: boolean; onConnect: () => void }) {
  if (!connected) {
    const target = SIGNAL_TARGET[tab.signal];
    return (
      <ConnectPrompt title={`이 앱의 ${connectObject(target)} 연결하세요`} description={`${tab.connect} 연결을 누르면 이 앱의 API Key에 권한을 더하고 설정 예시를 받습니다.`}>
        <Button onClick={onConnect}><MaterialIcon name="add" />{connectAction(target)}</Button>
      </ConnectPrompt>
    );
  }
  return <AppTabPanel tab={tab.key} {...panel} />;
}

/** 데이터 화면은 Docker 서비스 상세와 같은 컴포넌트다(소스만 앱이다). 탭마다 필요한 조회만 한다. */
function AppTabPanel({ tab, app, range, token, traceId, onRotateKey, onChanged }: PanelProps & { tab: AppTabItem['key'] }) {
  if (tab === 'logs') return <DirectServiceLogsTab observedServiceId={app.id} refreshKey={token} range={range} traceId={traceId} />;
  if (tab === 'traces') return <AppTraces app={app} range={range} token={token} />;
  if (tab === 'requests') return <AppRequests app={app} range={range} token={token} traceId={traceId} onChanged={onChanged} />;
  return <AppMetrics app={app} range={range} token={token} onRotateKey={onRotateKey} />;
}

function AppTraces({ app, range, token }: { app: ObservedService; range: GlobalTimeRange; token: number }) {
  const window = useRequestWindow(range, token);
  return <DirectServiceTracesTab observedServiceId={app.id} refreshKey={token} range={range} window={window} />;
}

function AppRequests({ app, range, token, traceId, onChanged }: { app: ObservedService; range: GlobalTimeRange; token: number; traceId?: string; onChanged: () => Promise<void> }) {
  const window = useRequestWindow(range, token);
  // 트레이스 수신 기준. lastSeenAt은 로그 수신으로도 갱신되어 트레이스를 받은 적 없는 앱도 수신 중으로 보인다.
  const [collection, setCollection] = useState<CollectionStatus | undefined>();
  // 저장한 제외 경로. 서버 데이터를 다시 불러오기 전에도 개수가 맞게 이 값을 먼저 쓴다.
  const [savedPaths, setSavedPaths] = useState<string[] | null>(null);
  useEffect(() => {
    let current = true;
    api.getObservedServiceSetupStatus(app.id)
      .then((receipts) => { if (current) setCollection(receiptCollection(receipts, 'traces')); }, () => { if (current) setCollection(undefined); });
    return () => { current = false; };
  }, [app.id, token]);
  return (
    // 요청 → 제외 경로 설정 24px(group)
    <div className="page-stack">
      <DirectServiceRequestsTab observedServiceId={app.id} refreshKey={token} range={range} window={window} traceId={traceId} awaitingData={collection === 'waiting'} noun="앱" />
      <ApiExclusionsSettings key={app.id} serviceId={app.id} paths={savedPaths ?? app.apiExcludePaths ?? []}
        onSaved={(paths) => { setSavedPaths(paths); void onChanged(); }} />
    </div>
  );
}

function AppMetrics({ app, range, token, onRotateKey }: { app: ObservedService; range: GlobalTimeRange; token: number; onRotateKey: () => void }) {
  const metricHealth = useMetricHealth({ kind: 'direct', observedServiceId: app.id }, token);
  return (
    <DirectServiceMetricsTab observedServiceId={app.id} state={metricHealth} refreshKey={token} range={range} active={app.isActive} noun="앱"
      empty={app.isActive ? (
        <EmptyState icon="schedule" title="메트릭 수신 대기"
          description="앱을 다시 시작하면 1분 안에 첫 메트릭이 들어옵니다(내보내기 주기 기본 60초). 연결 설정이 없다면 API Key를 재발급해 새 설정을 받으세요."
          action={{ label: '설정 다시 받기', onClick: onRotateKey }} />
      ) : undefined} />
  );
}
