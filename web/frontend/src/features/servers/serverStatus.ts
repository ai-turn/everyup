import { COLLECTION_STATUS_LABEL } from '../../components/common/collectionStatus';
import type { StatusTone } from '../../components/common/statusTone';
import type { InfrastructureResource, LogServiceSummary, ObservedService, ObservedServiceMetricName, Server, UptimeMonitor } from '../../services/api';
import { formatDateTime, formatDuration } from '../../utils/incidentFormat';
import { isCollectorFresh } from '../../utils/operationalStatus';
import { infraCollection, peakUsage, WARNING_PCT } from '../infra/usage';
import { metricTitle } from '../metrics/metricPresentation';
import { uptimeState, UPTIME_STATE_LIGHT } from '../uptime/uptimeState';
import { SERVER_CAPABILITIES, serverPath, type ServerCapability } from './serverPaths';
import type { ForgetTarget } from './useServers';

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

export interface TargetState {
  state: StatusTone;
  detail: string;
  /** 사용률 때문에 확인 필요일 때 그 기준(%). 화면이 "기준 70%"처럼 함께 적는다. */
  threshold?: number;
}

// 업타임 화면과 같은 판정과 문구를 쓴다. 일시정지한 모니터는 마지막 상태와 관계없이 대기다.
export function monitorState(monitor: UptimeMonitor): TargetState {
  const [state, detail] = UPTIME_STATE_LIGHT[uptimeState(monitor)];
  return { state, detail };
}

// 앱은 lastSeenAt이 오래돼도 정상으로 둔다. 로그·트레이스는 사건이 있을 때만 오므로 조용한 것이 장애가 아니다.
export function appState(service: ObservedService): TargetState {
  if (!service.isActive) return { state: 'idle', detail: '연결 비활성화됨' };
  if (!service.lastSeenAt) return { state: 'warn', detail: '데이터 대기 중' };
  return { state: 'healthy', detail: `마지막 수신 ${formatDateTime(service.lastSeenAt)}` };
}

const USAGE = [['cpuUsage', 'CPU'], ['memoryUsage', '메모리'], ['diskUsage', '디스크']] as const;

// 사용률만으로는 장애가 되지 않는다. 인프라 화면이 주의로 칠하는 선(WARNING_PCT)부터 확인 필요다.
export function infrastructureState(resource: InfrastructureResource): TargetState {
  if (!resource.isActive) return { state: 'idle', detail: 'Collector 비활성화됨' };
  if (!isCollectorFresh(resource.lastSeenAt)) return { state: 'warn', detail: '데이터 확인 필요' };
  const peak = peakUsage(resource);
  if (peak >= WARNING_PCT) {
    const label = USAGE.find(([key]) => resource[key] === peak)?.[1] ?? '사용률';
    return { state: 'warn', detail: `${label} ${peak.toFixed(1)}%`, threshold: WARNING_PCT };
  }
  return { state: 'healthy', detail: '데이터 유입 중' };
}

export interface ServerTargets { monitors: UptimeMonitor[]; apps: ObservedService[]; infrastructure?: InfrastructureResource }

/** 문제가 있는 대상 하나. 서버 목록의 원인 문구와 같은 판정과 문구다. */
export interface TargetIssue {
  kind: 'monitor' | 'infrastructure' | 'app';
  id: string;
  name: string;
  state: 'error' | 'warn';
  /** 대상 이름을 뺀 원인("응답 없음, 3분째", "CPU 88.0%", "데이터 대기 중") */
  detail: string;
  /** 서버 목록의 원인 문구. 모니터와 앱은 이름을 앞에 붙인다. */
  text: string;
  to: string;
  /** 모니터는 마지막 체크, 인프라는 마지막 수신, 앱은 마지막 수신이나 연결한 때 */
  observedAt?: string;
  /** 사용률 때문에 확인 필요일 때 그 기준(%) */
  threshold?: number;
}

export interface ServerRow {
  server: Server;
  targets: ServerTargets;
  state: StatusTone;
  /** 지금 불러온 대상 가운데 장애·확인 필요인 것(같은 상태 안에서 원인 우선순위 순). 개요의 "현재 확인 필요"가 쓴다. */
  issues: TargetIssue[];
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
  /**
   * 다시 불러오지 못해 대상 목록이 이전에 불러온 것인 기능. 목록과 개수는 남지만 상태 판정에서는 unknownCapabilities와 같다
   * (서버 상태, 원인, 기능별 상태, 수치에 쓰지 않는다). 서버 목록 자체를 불러오지 못한 경우는 여기에 들어가지 않는다.
   */
  staleCapabilities: ServerCapability[];
  /** 임계값을 넘은 지표가 있는 앱의 ID(지금 불러온 앱 가운데 연결이 켜진 것). 메트릭 기능에서 확인 필요다. */
  breachedApps: string[];
}

/** 메트릭의 확인 필요는 두 가지 까닭이 있다. 임계값 초과가 데이터 대기보다 먼저 보인다. */
const BREACHED_LABEL = '임계값 초과';

/**
 * 앱의 기능별 상태와 문구. 메트릭은 임계값을 넘은 지표가 있으면 확인 필요(임계값 초과)다.
 * 로그와 API 요청은 그 신호의 수신 여부만 본다.
 */
export function appCapabilityState(row: ServerRow, capability: 'logs' | 'api' | 'metrics', app: ObservedService): { state: StatusTone; label: string } {
  if (capability === 'metrics' && row.breachedApps.includes(app.id)) return { state: 'warn', label: BREACHED_LABEL };
  const { state } = appState(app);
  return { state, label: capabilityStateLabel(capability, state) };
}

/** 패널의 상태 줄. 탭이 탭의 점과 같은 판정으로 정해서 넘긴다. */
export interface PanelStatus {
  tone: StatusTone;
  label: string;
  /** 상태 뒤의 원인(인프라의 사용률과 기준, 수집 상태) */
  detail?: string;
  /** 대상이 이전에 불러온 정보다. 상태는 확인 불가이고 마지막 수집 시각도 지금의 값처럼 보이지 않는다. */
  stale: boolean;
}

const UNVERIFIED: PanelStatus = { tone: 'idle', label: '확인 불가', stale: true };

export function appPanelStatus(row: ServerRow, capability: 'logs' | 'api' | 'metrics', app: ObservedService, stale: boolean): PanelStatus {
  if (stale) return UNVERIFIED;
  const { state, label } = appCapabilityState(row, capability, app);
  return { tone: state, label, stale: false };
}

export function infrastructurePanelStatus(resource: InfrastructureResource, stale: boolean): PanelStatus {
  if (stale) return UNVERIFIED;
  const { state, detail, threshold } = infrastructureState(resource);
  // 사용률이면 그 값과 기준, 수집 문제면 목록과 같은 수집 상태 문구(수신 대기, 수집 지연). "확인 필요 데이터 확인 필요"처럼 되풀이하지 않는다.
  const reason = state === 'healthy' ? undefined
    : threshold !== undefined ? `${detail}, 기준 ${threshold}%`
      : state === 'warn' ? COLLECTION_STATUS_LABEL[infraCollection(resource)] : detail;
  return { tone: state, label: STATE_LABEL[state], detail: reason, stale: false };
}

/** 기능 전체의 상태 문구(탭의 상태 점, 개요의 기능 행). 메트릭의 확인 필요는 임계값 초과인 앱이 있으면 그 까닭을 쓴다. */
export function capabilityLabel(row: ServerRow, capability: ServerCapability, state: StatusTone): string {
  if (capability === 'metrics' && state === 'warn' && capabilityTargets(row.targets, 'metrics').some((app) => row.breachedApps.includes(app.id))) return BREACHED_LABEL;
  return capabilityStateLabel(capability, state);
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


// 앱을 여는 탭은 그룹 화면과 같은 순서(로그 > 메트릭 > API)로 고른다. 명령 팔레트도 같은 탭으로 연다.
export const appCapability = (app: ObservedService): ServerCapability =>
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
  /** 이 기능의 대상 목록을 불러오지 못했고 이전 목록도 없다. 연결 안내 대신 불러오지 못했다는 안내를 보여 준다. */
  unknown?: boolean;
  /** 서버 목록이나 이 기능의 대상 목록을 다시 불러오지 못해 row의 대상이 이전 정보다. 대상이 없다고 단정하지 않는다. */
  stale?: boolean;
  onRetry?: () => void;
  /** 머리말의 새로고침을 누를 때마다 1 오른다(자동 갱신은 올리지 않는다). 패널이 자기 데이터도 다시 불러온다. */
  refreshToken: number;
  /** 머리말의 `30초마다 자동 갱신` 스위치. 패널이 자기 데이터를 주기적으로 갱신하면 이 값을 따른다. */
  autoRefresh: boolean;
  /** 삭제·연결 해제한 대상을 서버 데이터의 이전 목록에 반영한다(useServers.forgetTarget). */
  forgetTarget?: ForgetTarget;
  /** 탭 줄 오른쪽의 조작 자리. 대상이 연결된 탭이 추가 버튼을 여기로 포털한다(TabAction). 그려지기 전에는 null이다. */
  actionSlot?: HTMLElement | null;
}

export function buildServerRows(input: {
  servers: Server[];
  monitors: UptimeMonitor[] | null;        // null은 조회 실패
  apps: ObservedService[] | null;
  infrastructure: InfrastructureResource[] | null;
  logSummaries: LogServiceSummary[] | null;
  /** 모든 앱의 지표 목록(임계값 초과 판정용). null은 조회 실패: 수신 여부만으로 판정한다. */
  metricCatalog?: ObservedServiceMetricName[] | null;
  /** 다시 불러오다 실패해서 이전에 성공한 목록을 준 종류 */
  stale?: { monitors?: boolean; apps?: boolean; infrastructure?: boolean };
}): ServerRow[] {
  // 지금 불러온 목록이 있는 종류. 이전 목록은 대상을 보여 주는 데만 쓰고 상태를 정하는 데는 쓰지 않는다.
  const known = {
    monitors: Boolean(input.monitors) && !input.stale?.monitors,
    apps: Boolean(input.apps) && !input.stale?.apps,
    infrastructure: Boolean(input.infrastructure) && !input.stale?.infrastructure,
  };
  // 앱마다 임계값을 넘은 지표. 옛 메트릭 목록과 같이 연결을 끈 앱은 판정하지 않는다.
  const breaches = new Map<string, ObservedServiceMetricName[]>();
  for (const metric of input.metricCatalog ?? []) {
    if (metric.breached) breaches.set(metric.serviceId, [...(breaches.get(metric.serviceId) ?? []), metric]);
  }
  const breachedOf = (app: ObservedService) => (app.isActive && app.signals.includes('metrics') ? breaches.get(app.id) ?? [] : []);
  return input.servers.map((server): ServerRow => {
    const monitors = input.monitors?.filter((monitor) => monitor.serverId === server.id) ?? [];
    const apps = input.apps?.filter((app) => app.serverId === server.id) ?? [];
    // Docker 환경에서 온 리소스에는 serverId가 없으므로 어느 서버에도 들어오지 않는다.
    const infrastructure = input.infrastructure?.find((resource) => resource.serverId === server.id);
    // 상태, 원인, 수치는 지금 불러온 대상으로만 정한다.
    const current = {
      monitors: known.monitors ? monitors : [],
      apps: known.apps ? apps : [],
      infrastructure: known.infrastructure ? infrastructure : undefined,
    };

    // 순서가 같은 상태 안의 우선순위다: 모니터 장애가 앱의 대기보다 먼저 원인으로 보인다.
    const candidates: (Omit<TargetIssue, 'state'> & { state: StatusTone })[] = [
      ...current.monitors.map((monitor) => {
        const result = monitorState(monitor);
        const incident = monitor.activeIncident?.active ? monitor.activeIncident : undefined;
        const detail = result.state === 'error' ? `응답 없음${incident ? `, ${formatDuration(incident.durationSec)}째` : ''}` : result.detail;
        return { kind: 'monitor' as const, id: monitor.id, name: monitor.name, state: result.state, detail, text: `${monitor.name} ${detail}`, to: serverPath(server.id, 'uptime', monitor.id), observedAt: monitor.lastCheckAt };
      }),
      ...(current.infrastructure ? [current.infrastructure].map((resource) => {
        const result = infrastructureState(resource);
        return { kind: 'infrastructure' as const, id: resource.id, name: resource.name, state: result.state, detail: result.detail, text: result.detail, to: serverPath(server.id, 'infrastructure'), observedAt: resource.lastSeenAt, threshold: result.threshold };
      }) : []),
      ...current.apps.map((app) => {
        const breached = breachedOf(app);
        const base = { kind: 'app' as const, id: app.id, name: app.name, observedAt: app.lastSeenAt ?? app.createdAt };
        if (breached.length > 0) {
          // 옛 메트릭 목록의 표현: 까닭(임계값 초과)과 첫 지표 이름, 나머지 개수.
          const detail = `${BREACHED_LABEL} ${metricTitle(breached[0])}${breached.length > 1 ? ` 외 ${breached.length - 1}개` : ''}`;
          return { ...base, state: 'warn' as const, detail, text: `${app.name} ${detail}`, to: serverPath(server.id, 'metrics', app.id) };
        }
        const result = appState(app);
        return { ...base, state: result.state, detail: result.detail, text: `${app.name} ${result.detail}`, to: serverPath(server.id, appCapability(app), app.id) };
      }),
    ];
    // 확인할 수 없는 기능: 목록을 불러오지 못했거나(대상이 있는지 모른다, 앱은 기능을 모르므로 "앱") 이전 목록에 대상이 있다.
    const unverified = [
      ...(!input.monitors || (!known.monitors && monitors.length > 0) ? ['업타임'] : []),
      ...(!input.infrastructure || (!known.infrastructure && infrastructure) ? ['인프라'] : []),
      ...(!input.apps ? ['앱'] : known.apps ? [] : SERVER_CAPABILITIES
        .filter(({ key }) => key !== 'uptime' && key !== 'infrastructure' && apps.some((app) => app.signals.includes(SIGNAL_OF[key as 'logs' | 'api' | 'metrics'])))
        .map(({ label }) => label)),
    ];
    const checked = worst(candidates.map((candidate) => candidate.state)) ?? 'idle';
    // 확인한 장애와 확인 필요는 그대로다. 그 밖에는 확인하지 못한 기능이 있으면 정상이라고 하지 않고 대기로 둔다:
    // 장애 중인 모니터의 목록만 불러오지 못한 서버가 남은 인프라로 정상이 되면 안 된다.
    const unsure = unverified.length > 0 && (checked === 'healthy' || checked === 'idle');
    const state: StatusTone = unsure ? 'idle' : checked;
    // 대기도 까닭을 적는다. 대상이 없으면 링크 없는 문구다. 확인할 수 없는 기능이 있으면 대상이 없다고 단정하지 않고 그 기능을 적는다.
    const culprit = unsure ? { text: `${unverified.join(', ')} 확인 불가`, to: undefined }
      : state === 'healthy' ? undefined
        : candidates.find((candidate) => candidate.state === state)
          ?? (known.monitors && known.apps && known.infrastructure ? { text: '연결한 대상 없음', to: undefined } : undefined);

    const appsWith = (capability: 'logs' | 'api' | 'metrics') => current.apps.filter((app) => app.signals.includes(SIGNAL_OF[capability]));
    const logApps = appsWith('logs');
    const errorLogs = known.apps && input.logSummaries && logApps.length > 0
      ? logApps.reduce((sum, app) => sum + (input.logSummaries!.find((summary) => summary.serviceId === app.id)?.error ?? 0), 0)
      : undefined;
    const uptimes = current.monitors.map((monitor) => monitor.uptime).filter((value): value is number => value !== undefined);

    return {
      server,
      targets: { monitors, apps, infrastructure },
      state,
      cause: culprit && { text: culprit.text, to: culprit.to },
      issues: candidates.filter((candidate): candidate is TargetIssue => candidate.state === 'error' || candidate.state === 'warn'),
      capabilities: {
        uptime: worst(current.monitors.map((monitor) => monitorState(monitor).state)),
        infrastructure: current.infrastructure ? infrastructureState(current.infrastructure).state : null,
        logs: worst(logApps.map((app) => appState(app).state)),
        api: worst(appsWith('api').map((app) => appState(app).state)),
        metrics: worst(appsWith('metrics').map((app) => (breachedOf(app).length > 0 ? 'warn' : appState(app).state))),
      },
      cpu: current.infrastructure?.cpuUsage,
      memory: current.infrastructure?.memoryUsage,
      disk: current.infrastructure?.diskUsage,
      uptime: uptimes.length ? Math.min(...uptimes) : undefined,
      errorLogs,
      // 로그 요약만 실패했으면 로그 앱이 없는 서버는 여전히 수집 안 함이다.
      unavailable: [
        ...(known.infrastructure ? [] : ['cpu', 'memory', 'disk'] as const),
        ...(known.monitors ? [] : ['uptime'] as const),
        ...(!known.apps || (!input.logSummaries && logApps.length > 0) ? ['errorLogs'] as const : []),
      ],
      unknownCapabilities: [
        ...(input.monitors ? [] : ['uptime'] as const),
        ...(input.infrastructure ? [] : ['infrastructure'] as const),
        ...(input.apps ? [] : ['logs', 'api', 'metrics'] as const),
      ],
      breachedApps: current.apps.filter((app) => breachedOf(app).length > 0).map((app) => app.id),
      staleCapabilities: [
        ...(input.monitors && !known.monitors ? ['uptime'] as const : []),
        ...(input.infrastructure && !known.infrastructure ? ['infrastructure'] as const : []),
        ...(input.apps && !known.apps ? ['logs', 'api', 'metrics'] as const : []),
      ],
    };
  }).sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.server.name.localeCompare(b.server.name));
}

/** 이 기능의 상태를 지금 알 수 없다: 목록을 불러오지 못했거나 이전에 불러온 목록이다. */
export const capabilityUnverified = (row: ServerRow, capability: ServerCapability) =>
  row.unknownCapabilities.includes(capability) || row.staleCapabilities.includes(capability);
