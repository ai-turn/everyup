import type { StatusTone } from '../../components/common/statusTone';
import type { InfrastructureResource, LogServiceSummary, ObservedService, Server, UptimeMonitor } from '../../services/api';
import { formatDuration } from '../../utils/incidentFormat';
import { isCollectorFresh } from '../../utils/operationalStatus';
import { peakUsage, WARNING_PCT } from '../infra/usage';
import { serverPath, type ServerCapability } from './serverPaths';

// 서버 목록, 서버 개요, 그룹 화면이 같은 판정을 쓴다. 따로 계산하면 목록은 "정상"인데 그룹은 "장애"인 대상이 생긴다.

/** 문제가 먼저: 장애, 확인 필요, 대기, 정상. */
export const STATE_ORDER: Record<StatusTone, number> = { error: 0, warn: 1, idle: 2, healthy: 3 };
export const STATE_LABEL: Record<StatusTone, string> = { error: '장애', warn: '확인 필요', idle: '대기', healthy: '정상' };

export interface TargetState { state: StatusTone; detail: string }

export function monitorState(monitor: UptimeMonitor): TargetState {
  if (monitor.status === 'unhealthy') return { state: 'error', detail: '장애' };
  if (monitor.status === 'healthy') return { state: 'healthy', detail: '정상' };
  return { state: 'idle', detail: '상태 확인 중' };
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
  /** 가장 나쁜 대상의 원인과 그 대상의 주소. 정상이거나 대상이 없으면 없다. */
  cause?: { text: string; to: string };
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

const worst = (states: StatusTone[]): StatusTone | null =>
  states.reduce<StatusTone | null>((current, state) => current === null || STATE_ORDER[state] < STATE_ORDER[current] ? state : current, null);

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
  /** 대상이 추가·삭제·이동된 뒤 서버 데이터를 다시 불러온다 */
  onChanged: () => void;
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
        const text = result.state === 'error' ? `응답 없음${incident ? `, ${formatDuration(incident.durationSec)}째` : ''}` : result.detail;
        return { ...result, text, to: serverPath(server.id, 'uptime', monitor.id) };
      }),
      ...(infrastructure ? [infrastructureState(infrastructure)].map((result) => ({ ...result, text: result.detail, to: serverPath(server.id, 'infrastructure') })) : []),
      ...apps.map((app) => {
        const result = appState(app);
        return { ...result, text: result.detail, to: serverPath(server.id, appCapability(app), app.id) };
      }),
    ];
    const state = worst(candidates.map((candidate) => candidate.state)) ?? 'idle';
    const culprit = state === 'error' || state === 'warn' ? candidates.find((candidate) => candidate.state === state) : undefined;

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
