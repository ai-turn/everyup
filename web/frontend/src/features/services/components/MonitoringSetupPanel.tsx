import { MaterialIcon } from '../../../components/common/MaterialIcon';
import type { CollectorSetupStatus } from '../../../services/api/agents';
import { useSetupStatus } from '../useSetupStatus';
import { ReceiptPanel } from './TelemetryReceiptStatus';
import type {
	AgentCollectionCapability,
	AgentCapabilityState,
  AgentCapabilityStatus,
  AgentServiceSnapshot,
  ConnectedAgent,
} from '../../../services/api';

const PROFILE_CAPABILITIES: { capability: AgentCollectionCapability; label: string }[] = [
  { capability: 'uptime', label: '업타임' },
  { capability: 'logs', label: '로그' },
  { capability: 'infrastructure', label: '인프라' },
  { capability: 'api', label: 'API' },
  { capability: 'metrics', label: '메트릭' },
];

const profileLabels = {
  'all-in-one': '전체 수집',
  basic: '기본 수집',
  custom: '사용자 지정',
} as const;

const capabilityReasons: Record<string, string> = {
  disabled: '설정에서 꺼져 있습니다',
  docker_unreachable: 'Docker 소켓에 연결할 수 없습니다',
  hostfs_unavailable: '호스트 파일시스템 마운트를 확인하세요',
  unsupported_arch: '지원하지 않는 CPU 아키텍처입니다',
  kernel_unknown: '호스트 커널을 확인할 수 없습니다',
  unsupported_kernel: 'eBPF를 지원하지 않는 커널입니다',
  btf_missing: '커널 BTF 정보가 없습니다',
  docker_required: 'Docker 자동 탐색이 필요합니다',
  observer_not_running: 'eBPF Observer가 실행 중이 아닙니다',
  automatic_tracing_unavailable: '자동 API 추적을 먼저 사용할 수 있어야 합니다',
  not_enabled: '고급 분산 추적 옵션이 꺼져 있습니다',
  kernel_too_old: 'Linux 5.17 이상이 필요합니다',
  kernel_lockdown: '커널 Lockdown 정책이 eBPF 쓰기를 차단합니다',
  lockdown_unknown: '커널 Lockdown 상태를 확인해야 합니다',
};

type SetupState = 'ready' | 'waiting' | 'issue' | 'optional';

interface SetupStepProps {
  number: number;
  title: string;
  description: string;
  state: SetupState;
  stateLabel: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props {
  setupStatus?: CollectorSetupStatus | null;
  agent: ConnectedAgent;
  services: AgentServiceSnapshot[];
  onInstall?: () => void;
  onInstrument?: () => void;
  compact?: boolean;
  className?: string;
}

function capabilityState(status?: AgentCapabilityStatus): SetupState {
  if (!status) return 'waiting';
  return status.state === 'available' ? 'ready' : 'issue';
}

function capabilityLabel(status?: AgentCapabilityStatus): string {
  if (!status) return '확인 중';
  if (status.state === 'available') return '완료';
  if (status.state === 'degraded') return '확인 필요';
  return '사용 불가';
}

function capabilityDetail(status?: AgentCapabilityStatus): string | undefined {
  if (!status) return undefined;
  if (!status.reason) return status.detail;
  return capabilityReasons[status.reason] ?? status.detail ?? status.reason;
}

function combineCapabilityState(states: (AgentCapabilityState | undefined)[]): SetupState {
  if (states.every((state) => state === 'available')) return 'ready';
  if (states.some((state) => state === 'degraded' || state === 'unavailable')) return 'issue';
  return 'waiting';
}

function SetupStep({
  number,
  title,
  description,
  state,
  stateLabel,
  detail,
  actionLabel,
  onAction,
}: SetupStepProps) {
  const appearance = {
    ready: {
      icon: 'check',
      circle: 'bg-status-healthy text-white',
      badge: 'bg-status-healthy/10 text-status-healthy',
    },
    waiting: {
      icon: String(number),
      circle: 'bg-primary/10 text-primary',
      badge: 'bg-status-idle/10 text-status-idle',
    },
    issue: {
      icon: 'priority_high',
      circle: 'bg-status-warn/15 text-status-warn',
      badge: 'bg-status-warn/10 text-status-warn',
    },
    optional: {
      icon: String(number),
      circle: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    },
  }[state];

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-ui-border-soft bg-ui-hover-soft p-3">
      <div className="flex items-start gap-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${appearance.circle}`}>
          {state === 'ready' || state === 'issue' ? (
            <MaterialIcon size={16} name={appearance.icon} />
          ) : appearance.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="type-label text-text-base">{title}</h3>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${appearance.badge}`}>
              {stateLabel}
            </span>
          </div>
          <p className="mt-1 type-body text-text-muted">{description}</p>
        </div>
      </div>
      {detail && (
        <p className={`mt-2 rounded-md px-2 py-1.5 type-body ${state === 'issue' ? 'bg-status-warn/5 text-status-warn' : 'bg-ui-hover-soft text-text-muted'}`}>
          {detail}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg border border-ui-border bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-primary/40 hover:text-primary"
        >
          {actionLabel}
          <MaterialIcon size={16} name="arrow_forward" />
        </button>
      )}
    </div>
  );
}

export function MonitoringSetupPanel({ agent, services, setupStatus, onInstall, onInstrument, compact = false, className = '' }: Props) {
  const statusRequest = useSetupStatus<CollectorSetupStatus>(setupStatus === undefined ? `/agents/${agent.id}/setup-status` : null);
  const status = setupStatus ?? statusRequest.data;
  const report = agent.capabilities;
  const profile = agent.profile;
  const enabledCapabilities = profile?.capabilities.length
    ? profile.capabilities
    : PROFILE_CAPABILITIES.map((item) => item.capability);
  const enabledCapabilityLabels = PROFILE_CAPABILITIES
    .filter((item) => enabledCapabilities.includes(item.capability))
    .map((item) => item.label);
  const unavailableCapabilityLabels = PROFILE_CAPABILITIES
    .filter((item) => !enabledCapabilities.includes(item.capability))
    .map((item) => item.label);
  const connected = Boolean(status?.connected) && !statusRequest.error;
  const received = (signal: string) => Boolean(status?.signals.some(item => item.signal === signal));
  const containerCollectionEnabled = enabledCapabilities.includes('uptime') || enabledCapabilities.includes('logs');
  const infrastructureEnabled = enabledCapabilities.includes('infrastructure');
  const apiEnabled = enabledCapabilities.includes('api');
  const basicCapabilityState = containerCollectionEnabled || infrastructureEnabled
    ? combineCapabilityState([
      ...(containerCollectionEnabled ? [report?.containerMonitoring.state] : []),
      ...(infrastructureEnabled ? [report?.hostMetrics.state] : []),
    ])
    : 'optional';
  const basicDataReady = (!enabledCapabilities.includes('uptime') || received('uptime')) && (!enabledCapabilities.includes('logs') || received('logs')) && (!infrastructureEnabled || received('infrastructure'));
  const basicState = basicCapabilityState === 'ready' && (!connected || !basicDataReady) ? 'waiting' : basicCapabilityState;
  const traceCapabilityState = apiEnabled ? capabilityState(report?.automaticTracing) : 'optional';
  const tracingState = traceCapabilityState === 'ready' && (!connected || !received('traces')) ? 'waiting' : traceCapabilityState;
  const injectable = services.filter((service) => service.runtime === 'java' || service.runtime === 'node');
  const metricsEnabled = enabledCapabilities.includes('metrics');
  const requiredTotal = 1 + Number(containerCollectionEnabled || infrastructureEnabled) + Number(apiEnabled) + Number(metricsEnabled);
  const requiredReady = Number(connected && status?.configApplied) + Number(basicState === 'ready') + Number(tracingState === 'ready') + Number(metricsEnabled && connected && received('metrics'));
  const requiredComplete = requiredReady === requiredTotal;
  const basicProblem = [
    ...(containerCollectionEnabled ? [report?.containerMonitoring] : []),
    ...(infrastructureEnabled ? [report?.hostMetrics] : []),
  ]
    .find((status) => status && status.state !== 'available');
  const basicIssue = basicState === 'optional'
    ? '현재 프로필에서 수집하지 않습니다.'
    : capabilityDetail(basicProblem);
  const traceDetail = capabilityDetail(report?.automaticTracing);
  const propagation = report?.contextPropagation;
  const propagationDetail = propagation
    ? `분산 추적 전파: ${capabilityLabel(propagation)}${capabilityDetail(propagation) ? ` · ${capabilityDetail(propagation)}` : ''}`
    : undefined;
  const host = report
    ? [report.host.os, report.host.kernelVersion && `kernel ${report.host.kernelVersion}`, report.host.arch]
      .filter(Boolean)
      .join(' · ')
    : '';
  const basicTitle = containerCollectionEnabled && infrastructureEnabled
    ? '컨테이너·로그·호스트'
    : containerCollectionEnabled ? '컨테이너·로그'
    : infrastructureEnabled ? '호스트 인프라'
    : '기본 수집';
  const basicDescription = containerCollectionEnabled && infrastructureEnabled
    ? '컨테이너 상태, stdout 로그와 호스트 메트릭을 수집합니다.'
    : containerCollectionEnabled ? '컨테이너 상태와 stdout 로그를 수집합니다.'
    : infrastructureEnabled ? '호스트 CPU·메모리·디스크를 수집합니다.'
    : '이 프로필에서는 별도 기본 수집기를 시작하지 않습니다.';

  return (
    <section className={`rounded-xl border border-ui-border bg-bg-surface p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="type-label text-text-base">모니터링 설정 가이드</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs ${requiredComplete ? 'bg-status-healthy/10 text-status-healthy' : 'bg-primary/10 text-primary'}`}>
              필수 {requiredReady}/{requiredTotal}
            </span>
          </div>
          <p className="mt-0.5 type-body text-text-muted">
            {requiredComplete
              ? '기본 모니터링 설정이 완료됐습니다. 필요할 때 상세 계측을 추가하세요.'
              : '위에서 아래 순서로 확인하면 별도 앱 수정 없이 기본 모니터링을 시작할 수 있습니다.'}
          </p>
          <p className="mt-2 type-body text-text-muted">
            수집 프로필: {profileLabels[profile?.kind ?? 'all-in-one']} · 사용 {enabledCapabilityLabels.join(', ')}
            {unavailableCapabilityLabels.length > 0 && ` · 미선택 ${unavailableCapabilityLabels.join(', ')}`}
          </p>
        </div>
        {report && (
          <div className="text-right text-xs text-text-dim">
            <p>{host || '호스트 정보 확인 중'} · {report.host.btf ? 'BTF 있음' : 'BTF 없음'}</p>
            <p className="mt-0.5">
              {new Date(report.checkedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 확인
            </p>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${compact ? '' : 'xl:grid-cols-4'}`}>
        <SetupStep
          number={1}
          title="Docker 수집기 연결"
          description="대상 Docker 서버와 EveryUp을 안전하게 연결합니다."
          state={connected ? 'ready' : 'waiting'}
          stateLabel={connected ? '완료' : '설치 필요'}
          detail={connected ? `Docker 수집기 ${agent.version ? `v${agent.version}` : ''} 연결됨` : '일회용 명령을 서버에서 실행하세요.'}
          actionLabel={onInstall ? (connected ? '재설치 명령' : '설치 명령') : undefined}
          onAction={onInstall}
        />
        <SetupStep
          number={2}
          title={basicTitle}
          description={basicDescription}
          state={basicState}
          stateLabel={basicState === 'optional' ? '미선택' : basicState === 'ready' ? '완료' : basicState === 'issue' ? '확인 필요' : '진단 중'}
          detail={basicIssue}
        />
        <SetupStep
          number={3}
          title="자동 API 추적"
          description="eBPF Observer로 코드 변경 없이 지연시간과 트레이스를 수집합니다."
          state={tracingState}
          stateLabel={tracingState === 'optional' ? '미선택' : tracingState === 'waiting' ? '첫 요청 대기' : capabilityLabel(report?.automaticTracing)}
          detail={tracingState === 'optional' ? '현재 프로필에서 수집하지 않습니다.' : traceDetail || propagationDetail}
        />
        <SetupStep
          number={4}
          title="헤더·바디 상세 계측"
          description="Java·Node.js에 OTel을 붙여 요청 진단 정보를 확장합니다."
          state="optional"
          stateLabel="선택 기능"
          detail={injectable.length > 0
            ? `${injectable.length}개 서비스에 안전 적용 가능`
            : services.length > 0 ? '현재 자동 적용 가능한 Java·Node.js 서비스가 없습니다.' : '서비스가 발견되면 적용 대상을 확인합니다.'}
          actionLabel={injectable.length > 0 && onInstrument ? '상세 계측 설정' : undefined}
          onAction={onInstrument}
        />
      </div>
      <div className="mt-3">
        <ReceiptPanel
          signals={status?.signals ?? []}
          expected={enabledCapabilities.map(capability => capability === 'api' ? 'traces' : capability)}
          error={statusRequest.error}
          note={!connected ? '최근 수집기 통신을 확인하는 중입니다.' : status?.configApplied ? '요청한 수집 설정의 적용을 확인했습니다.' : '설정 적용 확인이 필요합니다. 최신 설치 명령을 실행하세요.'}
        />
      </div>
    </section>
  );
}
