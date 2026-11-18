import type { StatusTone } from '../../components/common/statusTone';
import type { InfrastructureResource, LogServiceSummary, ObservedService, Server, UptimeMonitor } from '../../services/api';
import { formatDuration } from '../../utils/incidentFormat';
import { isCollectorFresh } from '../../utils/operationalStatus';
import { peakUsage, WARNING_PCT } from '../infra/usage';
import { uptimeState, UPTIME_STATE_LIGHT } from '../uptime/uptimeState';
import { serverPath, type ServerCapability } from './serverPaths';

// 서버 목록, 서버 개요, 그룹 화면이 같은 판정을 쓴다. 따로 계산하면 목록은 "정상"인데 그룹은 "장애"인 대상이 생긴다.

/** 문제가 먼저: 장애, 확인 필요, 대기, 정상. */
export const STATE_ORDER: Record<StatusTone, number> = { error: 0, warn: 1, idle: 2, healthy: 3 };
export const STATE_LABEL: Record<StatusTone, string> = { error: '장애', warn: '확인 필요', idle: '대기', healthy: '정상' };

/** 상태를 합칠 때의 심각도. 정렬 순서와 달리 정상이 대기보다 앞선다: 정상 9개와 일시정지 1개는 정상이다. */
const SEVERITY: Record<StatusTone, number> = { error: 0, warn: 1, healthy: 2, idle: 3 };

const APP_CAPABILITY_LABEL: Record<StatusTone, string> = { error: '장애', warn: '데이터 대기 중', idle: '연결 비활성화됨', healthy: '수집 중' };

/** 기능별 상태 문구. 로그, API 요청, 메트릭은 수신 여부만 판정하므로 "정상"이라고 쓰지 않는다. */
export function capabilityStateLabel(capability: ServerCapability, state: StatusTone): string {
  return capability === 'uptime' || capability === 'infrastructure' ? STATE_LABEL[state] : APP_CAPABILITY_LABEL[state];
}

export interface TargetState { state: StatusTone; detail: string }

// 업타임 화면과 같은 판정과 문구를 쓴다. 일시정지한 모니터는 마지막 상태와 관계없이 대기다.
export function monitorState(monitor: UptimeMonitor): TargetState {
  const [state, detail] = UPTIME_STATE_LIGHT[uptimeState(monitor)];
  return { state, detail };
}

// 앱은 lastSeenAt이 오래돼도 정상으로 둔다. 로그·트레이스는 사건이 있을 때만 오므로 조용한 것이 장애가 아니다.
export function appState(service: ObservedService): TargetState {
  if (!service.isActive) return { state: 'idle', detail: '연결 비활성화됨' };
  if (!service.lastSeenAt) return { state: 'warn', detail: '데이터 대기 중' };
  return { state: 'healthy', detail: `마지막 수신 ${new Date(service.lastSeenAt).toLocaleString()}` };
}

const USAGE = [['cpuUsage', 'CPU'], ['memoryUsage', '메모리'], ['diskUsage', '디스크']] as const;

// 사용률만으로는 장애가 되지 않는다. 인프라 화면이 주의로 칠하는 선(WARNING_PCT)부터 확인 필요다.
export function infrastructureState(resource: InfrastructureResource): TargetState {
  if (!resource.isActive) return { state: 'idle', detail: 'Collector 비활성화됨' };
  if (!isCollectorFresh(resource.lastSeenAt)) return { state: 'warn', detail: '데이터 확인 필요' };
  const peak = peakUsage(resource);
  if (peak >= WARNING_PCT) {
    const label = USAGE.find(([key]) => resource[key] === peak)?.[1] ?? '사용률';
    return { state: 'warn', detail: `${label} ${peak.toFixed(1)}%` };
  }
  return { state: 'healthy', detail: '데이터 유입 중' };
}

export interface ServerTargets { monitors: UptimeMonitor[]; apps: ObservedService[]; infrastructure?: InfrastructureResource }

export interface ServerRow {
  server: Server;
  targets: ServerTargets;
  state: StatusTone;
  /** 서버 상태의 원인과 그 대상의 주소. 정상이면 없고, 대상이 없으면 주소가 없다. */
  cause?: { text: string; to?: string };
  /** 기능별 상태. 연결된 대상이 없으면 null. */
  capabilities: Record<ServerCapability, StatusTone | null>;
  cpu?: number; memory?: number; disk?: number;
  /** 소속 모니터들의 24시간 가용률 가운데 가장 낮은 값 */
  uptime?: number;
  /** 로그 신호를 가진 앱들의 24시간 오류 로그 합계 */
  errorLogs?: number;
  /** 값이 없는 까닭이 수집하지 않아서가 아니라 조회에 실패해서인 수치 */
  unavailable: ServerMetric[];
  /** 대상 목록을 불러오지 못해 연결 여부를 모르는 기능. "연결 전"이 아니라 확인 불가다. */
  unknownCapabilities: ServerCapability[];
}

export type ServerMetric = 'cpu' | 'memory' | 'disk' | 'uptime' | 'errorLogs';

/** 여러 대상의 상태를 하나로 합친다(장애 > 확인 필요 > 정상 > 대기). 대상이 없으면 null. 그룹 요약도 같은 판정을 쓴다. */
export const worst = (states: StatusTone[]): StatusTone | null =>
  states.reduce<StatusTone | null>((current, state) => current === null || SEVERITY[state] < SEVERITY[current] ? state : current, null);

export const hasTargets = (targets: ServerTargets) =>
  targets.monitors.length > 0 || targets.apps.length > 0 || Boolean(targets.infrastructure);

export interface TargetCounts { monitors: number; apps: number; infrastructure: number }

export const countTargets = (targets: ServerTargets): TargetCounts =>
  ({ monitors: targets.monitors.length, apps: targets.apps.length, infrastructure: targets.infrastructure ? 1 : 0 });

/** 종류별 개수를 문구로. 0개인 종류는 뺀다. */
export const targetCountLabels = (counts: TargetCounts): string[] =>
  ([['업타임 모니터', counts.monitors], ['앱', counts.apps], ['인프라 리소스', counts.infrastructure]] as const)
    .filter(([, count]) => count > 0).map(([label, count]) => `${label} ${count}개`);


// 앱을 여는 탭은 그룹 화면과 같은 순서(로그 > 메트릭 > API)로 고른다.
const appCapability = (app: ObservedService): ServerCapability =>
  app.signals.includes('logs') ? 'logs' : app.signals.includes('metrics') ? 'metrics' : 'api';

const SIGNAL_OF: Record<'logs' | 'api' | 'metrics', ObservedService['signals'][number]> = { logs: 'logs', api: 'traces', metrics: 'metrics' };

/** 기능에 연결된 대상. 앱은 그 기능의 신호를 가진 것만. */
export function capabilityTargets(targets: ServerTargets, capability: ServerCapability): { id: string; name: string }[] {
  if (capability === 'uptime') return targets.monitors;
  if (capability === 'infrastructure') return targets.infrastructure ? [targets.infrastructure] : [];
  return targets.apps.filter((app) => app.signals.includes(SIGNAL_OF[capability]));
}

/** 서버 상세의 기능 탭이 받는 props. */
export interface ServerCapabilityTabProps {
  row: ServerRow;
  /** 경로의 :targetId. 없으면 탭의 첫 화면 */
  targetId?: string;
  /** 대상이 추가·삭제·이동된 뒤 서버 데이터를 다시 불러온다. 다시 불러온 결과가 반영되면 끝난다. */
  onChanged: () => Promise<void>;
  /** 이 기능의 대상 목록을 불러오지 못했다. 연결 안내 대신 불러오지 못했다는 안내를 보여 준다. */
  unknown?: boolean;
  onRetry?: () => void;
}

export function buildServerRows(input: {
  servers: Server[];
  monitors: UptimeMonitor[] | null;        // null은 조회 실패
  apps: ObservedService[] | null;
  infrastructure: InfrastructureResource[] | null;
  logSummaries: LogServiceSummary[] | null;
}): ServerRow[] {
  return input.servers.map((server): ServerRow => {
    const monitors = input.monitors?.filter((monitor) => monitor.serverId === server.id) ?? [];
    const apps = input.apps?.filter((app) => app.serverId === server.id) ?? [];
    // Docker 환경에서 온 리소스에는 serverId가 없으므로 어느 서버에도 들어오지 않는다.
    const infrastructure = input.infrastructure?.find((resource) => resource.serverId === server.id);

    // 순서가 같은 상태 안의 우선순위다: 모니터 장애가 앱의 대기보다 먼저 원인으로 보인다.
    const candidates = [
      ...monitors.map((monitor) => {
        const result = monitorState(monitor);
        const incident = monitor.activeIncident?.active ? monitor.activeIncident : undefined;
        const text = `${monitor.name} ${result.state === 'error' ? `응답 없음${incident ? `, ${formatDuration(incident.durationSec)}째` : ''}` : result.detail}`;
        return { ...result, text, to: serverPath(server.id, 'uptime', monitor.id) };
      }),
      ...(infrastructure ? [infrastructureState(infrastructure)].map((result) => ({ ...result, text: result.detail, to: serverPath(server.id, 'infrastructure') })) : []),
      ...apps.map((app) => {
        const result = appState(app);
        return { ...result, text: `${app.name} ${result.detail}`, to: serverPath(server.id, appCapability(app), app.id) };
      }),
    ];
    const state = worst(candidates.map((candidate) => candidate.state)) ?? 'idle';
    // 대기도 까닭을 적는다. 대상이 없으면 링크 없는 문구다. 대상 목록을 불러오지 못했으면 없다고 단정하지 않는다.
    const culprit = state === 'healthy' ? undefined
      : candidates.find((candidate) => candidate.state === state)
        ?? (input.monitors && input.apps && input.infrastructure ? { text: '연결한 대상 없음', to: undefined } : undefined);

    const appsWith = (capability: 'logs' | 'api' | 'metrics') => apps.filter((app) => app.signals.includes(SIGNAL_OF[capability]));
    const logApps = appsWith('logs');
    const errorLogs = input.apps && input.logSummaries && logApps.length > 0
      ? logApps.reduce((sum, app) => sum + (input.logSummaries!.find((summary) => summary.serviceId === app.id)?.error ?? 0), 0)
      : undefined;
    const uptimes = monitors.map((monitor) => monitor.uptime).filter((value): value is number => value !== undefined);

    return {
      server,
      targets: { monitors, apps, infrastructure },
      state,
      cause: culprit && { text: culprit.text, to: culprit.to },
      capabilities: {
        uptime: worst(monitors.map((monitor) => monitorState(monitor).state)),
        infrastructure: infrastructure ? infrastructureState(infrastructure).state : null,
        logs: worst(logApps.map((app) => appState(app).state)),
        api: worst(appsWith('api').map((app) => appState(app).state)),
        metrics: worst(appsWith('metrics').map((app) => appState(app).state)),
      },
      cpu: infrastructure?.cpuUsage,
      memory: infrastructure?.memoryUsage,
      disk: infrastructure?.diskUsage,
      uptime: uptimes.length ? Math.min(...uptimes) : undefined,
      errorLogs,
      // 로그 요약만 실패했으면 로그 앱이 없는 서버는 여전히 수집 안 함이다.
      unavailable: [
        ...(input.infrastructure ? [] : ['cpu', 'memory', 'disk'] as const),
        ...(input.monitors ? [] : ['uptime'] as const),
        ...(!input.apps || (!input.logSummaries && logApps.length > 0) ? ['errorLogs'] as const : []),
      ],
      unknownCapabilities: [
        ...(input.monitors ? [] : ['uptime'] as const),
        ...(input.infrastructure ? [] : ['infrastructure'] as const),
        ...(input.apps ? [] : ['logs', 'api', 'metrics'] as const),
      ],
    };
  }).sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.server.name.localeCompare(b.server.name));
}
