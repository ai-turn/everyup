import type { TabItem } from '../../../components/common';
import type { ObservedService, TelemetrySignal } from '../../../services/api';
import type { AppTab } from '../serverPaths';
import { appPanelStatus, worst, type ServerRow } from '../serverStatus';

export interface AppTabItem { key: AppTab; label: string; signal: TelemetrySignal; capability: 'logs' | 'api' | 'metrics'; connect: string }

// 탭 순서와 이름은 Docker 서비스 상세와 같다(업타임·인프라는 앱에 없다). capability는 서버 탭과 상태 판정의 이름이다.
export const APP_TABS: readonly AppTabItem[] = [
  { key: 'logs', label: '로그', signal: 'logs', capability: 'logs', connect: '앱의 OpenTelemetry 로그를 연결하면 이 탭에서 검색하고 추이를 봅니다.' },
  { key: 'requests', label: 'API 요청', signal: 'traces', capability: 'api', connect: '앱이 OpenTelemetry로 트레이스를 보내면 요청 상태와 오류를 확인할 수 있습니다.' },
  { key: 'traces', label: '트레이스', signal: 'traces', capability: 'api', connect: 'API 요청을 연결하면 요청이 거친 구간을 이 탭에서 볼 수 있습니다. 트레이스는 따로 연결하지 않습니다.' },
  { key: 'metrics', label: '메트릭', signal: 'metrics', capability: 'metrics', connect: '앱이 OpenTelemetry로 보내는 메트릭을 차트로 확인합니다.' },
];
export const DEFAULT_APP_TAB: Record<'logs' | 'api' | 'metrics', AppTab> = { logs: 'logs', api: 'requests', metrics: 'metrics' };
export const isAppTab = (value: string | null): value is AppTab => APP_TABS.some((tab) => tab.key === value);

/** 앱의 상태(받는 데이터 유형 중 가장 나쁜 것, 서버 탭의 점과 같은 판정)와 탭 줄, 아직 받지 않는 데이터 유형. */
export function appSummary(row: ServerRow, app: ObservedService, stale: boolean) {
  const connected = (signal: TelemetrySignal) => app.signals.includes(signal);
  const statuses = APP_TABS.filter((item, index) => connected(item.signal) && APP_TABS.findIndex((other) => other.capability === item.capability) === index)
    .map((item) => appPanelStatus(row, item.capability, app, stale));
  const worstTone = worst(statuses.map((status) => status.tone));
  const tabs: TabItem<AppTab>[] = APP_TABS.map((item) => {
    if (!connected(item.signal)) return { key: item.key, label: item.label, muted: true, caption: '연결 전' };
    const itemStatus = appPanelStatus(row, item.capability, app, stale);
    return { key: item.key, label: item.label, ...(itemStatus.tone === 'error' || itemStatus.tone === 'warn' ? { tone: itemStatus.tone, toneLabel: itemStatus.label } : {}) };
  });
  // 받지 않는 데이터 유형마다 그 유형의 첫 탭(traces는 API 요청 탭). 같은 유형의 탭은 하나로 센다.
  const missing = APP_TABS.filter((item, index) => !connected(item.signal) && APP_TABS.findIndex((other) => other.signal === item.signal) === index);
  return { status: statuses.find((candidate) => candidate.tone === worstTone) ?? statuses[0], tabs, missing };
}
