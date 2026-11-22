// 규칙 목록(데스크톱 표·카드, 모바일 카드)이 같이 쓰는 표시 규칙.
import { useEffect, useState } from 'react';
import type { AlertTarget } from './alertTarget';
import type { StatusTone } from '../../components/common';
import { api, type AlertRule, type AgentServiceFlat, type ConnectedAgent, type InfrastructureResource, type ObservedService, type Server, type UptimeMonitor } from '../../services/api';

/** 규칙 대상의 이름을 찾는 목록들. 업타임 규칙의 serviceId는 업타임 모니터일 수 있다. */
export interface TargetNames {
  agentServices: AgentServiceFlat[];
  agents: ConnectedAgent[];
  directServices: ObservedService[];
  infrastructureResources: InfrastructureResource[];
  uptimeMonitors: UptimeMonitor[];
  /** 직접 대상의 이름 앞에 붙일 서버 이름 */
  servers: Server[];
  /** 모든 목록을 받았는가. 하나라도 실패하면 이름이 없어도 지워졌다고 단정하지 않는다. */
  complete: boolean;
}

const EMPTY_NAMES: TargetNames = { agentServices: [], agents: [], directServices: [], infrastructureResources: [], uptimeMonitors: [], servers: [], complete: false };

/** 대상 이름 목록을 규칙 조회와 따로 받는다. 이름 하나가 실패해도 규칙 목록은 그대로 보인다(A-05). */
export function useTargetNames(): TargetNames {
  const [names, setNames] = useState<TargetNames>(EMPTY_NAMES);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      api.getAllAgentServicesFlat(),
      api.getAgents(),
      api.getObservedServices(),
      api.getInfrastructureResources(),
      api.getUptimeMonitors(),
      api.getServers(),
    ]).then(([agentServices, agents, directServices, infrastructureResources, uptimeMonitors, servers]) => {
      if (!active) return;
      const rows = <T,>(result: PromiseSettledResult<T[] | null | undefined>): T[] => result.status === 'fulfilled' ? result.value ?? [] : [];
      setNames({
        agentServices: rows(agentServices),
        agents: rows(agents),
        directServices: rows(directServices),
        infrastructureResources: rows(infrastructureResources),
        uptimeMonitors: rows(uptimeMonitors),
        servers: rows(servers),
        // 서버 이름은 대상이 있는지와 관계없다. 서버 목록만 실패하면 이름 앞의 서버가 빠질 뿐이다.
        complete: [agentServices, agents, directServices, infrastructureResources, uptimeMonitors].every(result => result.status === 'fulfilled'),
      });
    });
    return () => { active = false; };
  }, []);
  return names;
}

/** 직접 대상(모니터, 앱, Collector 리소스)의 라벨: `서버 이름 / 대상 이름`. 서버를 찾지 못하면 대상 이름만 쓴다. */
export function directTargetLabel(target: { name: string; serverId?: string }, servers: Server[]): string {
  const server = servers.find(row => row.id === target.serverId);
  return server ? `${server.name} / ${target.name}` : target.name;
}

/** 서버 화면 쪽 대상(앱, 모니터)을 ID로 찾아 라벨을 만든다. */
function directName(id: string, names: TargetNames): string | undefined {
  const target = names.directServices.find(service => service.id === id) ?? names.uptimeMonitors.find(monitor => monitor.id === id);
  return target && directTargetLabel(target, names.servers);
}

// Docker 환경의 리소스는 서버가 없으므로 이름만 쓴다(directTargetLabel이 그렇게 한다).
function infrastructureName(id: string, names: TargetNames): string | undefined {
  const resource = names.infrastructureResources.find(row => row.id === id);
  return resource && directTargetLabel(resource, names.servers);
}

/** 규칙 대상의 표시. 이름을 찾지 못하면 `missingId`에 내부 ID를 둔다 — 화면은 설명 뒤에 흐린 글자로 붙인다. */
export interface TargetParts {
  label: string;
  missingId?: string;
}

// 이름을 찾지 못하면 지워진 대상이다. 이름 목록을 다 받지 못했을 때는 지워졌는지 모르므로 그렇게 말한다.
// 내부 ID만 맨 글자로 보이면 무엇인지 읽히지 않았다(UI/UX 점검 A2).
function missingTarget(id: string, names: TargetNames): TargetParts {
  return { label: names.complete ? '삭제된 대상' : '이름을 불러오지 못한 대상', missingId: id };
}

const found = (label: string | undefined): TargetParts | undefined => label === undefined ? undefined : { label };

/** 검색·정렬·툴팁처럼 글자 하나가 필요한 자리의 대상 이름. ID는 괄호로 붙인다. */
export function joinTargetParts({ label, missingId }: TargetParts): string {
  return missingId ? `${label} (${missingId})` : label;
}

export function targetLabel(rule: AlertRule, names: TargetNames): string {
  return joinTargetParts(targetParts(rule, names));
}

export function targetParts(rule: AlertRule, names: TargetNames): TargetParts {
  const { agentServices, agents } = names;
  if (rule.type === 'service' || rule.type === 'log' || rule.type === 'request') {
    if (rule.serviceId) return found(directName(rule.serviceId, names)) ?? missingTarget(rule.serviceId, names);
    if (rule.agentId && rule.serviceKey) {
      const svc = agentServices.find(s => s.agentId === rule.agentId && s.key === rule.serviceKey);
      return svc ? { label: `${svc.agentName} / ${svc.name}` } : missingTarget(rule.serviceKey, names);
    }
    // Request rules can also watch a whole Docker environment (API-created).
    if (rule.type === 'request' && rule.agentId) return found(agents.find(a => a.id === rule.agentId)?.name) ?? missingTarget(rule.agentId, names);
    return { label: rule.type === 'log' ? '전체 로그 서비스' : rule.metric === 'otel_metric' ? '모든 서비스' : '전체 업타임 대상' };
  }
  if (rule.agentId) return found(infrastructureName(rule.agentId, names) ?? agents.find(a => a.id === rule.agentId)?.name) ?? missingTarget(rule.agentId, names);
  return { label: '전체 인프라' };
}

/** 대상 필터 줄의 이름. */
export function alertTargetName(target: AlertTarget, names: TargetNames): string {
  if (target.kind === 'direct') {
    return directName(target.serviceId, names) ?? joinTargetParts(missingTarget(target.serviceId, names));
  }
  if (target.kind === 'infrastructure') {
    return infrastructureName(target.resourceId, names) ?? joinTargetParts(missingTarget(target.resourceId, names));
  }
  const service = names.agentServices.find(item => item.agentId === target.agentId && item.key === target.serviceKey);
  return service ? `${service.agentName} / ${service.name}` : joinTargetParts(missingTarget(target.serviceKey, names));
}

// ─── 조건 문구 ──────────────────────────────────────────────────────────────

export const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const ENDPOINT_METRICS = new Set(['http_status', 'response_time']);

const OPERATOR_SYMBOLS: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
};

export type CategoryKey = 'all' | 'endpoint' | 'request' | 'log' | 'metric' | 'resource' | 'system';

export function ruleCategory(rule: AlertRule): Exclude<CategoryKey, 'all'> {
  if (rule.isSystem) return 'system';
  // 메트릭 규칙은 type이 service지만 업타임이 아니다 — metric으로 가른다.
  if (rule.metric === 'otel_metric') return 'metric';
  if (rule.type === 'service') return 'endpoint';
  if (rule.type === 'request') return 'request';
  if (rule.type === 'log') return 'log';
  return 'resource';
}

const CATEGORY_LABELS: Record<Exclude<CategoryKey, 'all'>, string> = {
  endpoint: '업타임',
  request: 'API 요청',
  log: '로그',
  metric: '메트릭',
  resource: '인프라',
  system: '시스템',
};

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU',
  memory: '메모리',
  disk: '디스크',
  status_change: '상태 변경',
  http_status: 'HTTP 상태',
  response_time: '응답 시간',
  log_level: '로그 레벨',
  api_status_code: 'API 상태',
  error_rate: '에러율',
  latency_p95: 'p95 지연',
  latency_p99: 'p99 지연',
};

// 연산자별 서술어. 없는 연산자는 기호 표기로 폴백한다.
const OPERATOR_WORDS: Record<string, string> = {
  gt: '초과',
  gte: '이상',
  lt: '미만',
  lte: '이하',
  eq: '같음',
};

export function categoryLabel(category: Exclude<CategoryKey, 'all'>): string {
  return CATEGORY_LABELS[category];
}

/** 규칙 유형 칩(DESIGN.md §4.1 FilterChips). 데스크톱 표와 모바일 목록이 같은 순서·개수를 쓴다. 0건인 유형도 자리를 지킨다. */
const RULE_CATEGORIES = Object.keys(CATEGORY_LABELS) as Exclude<CategoryKey, 'all'>[];
export const categoryChipOptions = (rules: AlertRule[]) => RULE_CATEGORIES.map((value) => ({
  value, label: CATEGORY_LABELS[value], count: rules.filter((rule) => ruleCategory(rule) === value).length,
}));

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric;
}

function thresholdValue(rule: AlertRule): string {
  const unit = rule.metric === 'response_time' || rule.metric === 'latency_p95' || rule.metric === 'latency_p99' ? 'ms' : ENDPOINT_METRICS.has(rule.metric) || rule.metric === 'log_level' || rule.metric === 'api_status_code' ? '' : '%';
  return `${rule.threshold}${unit}`;
}

// 로그 레벨은 숫자로 저장된다(0 TRACE … 4 ERROR). 목록에는 이름으로 쓴다(A-18).
const LOG_LEVEL_NAMES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

function conditionExpr(rule: AlertRule): string {
  if (rule.metric === 'log_level') {
    const level = LOG_LEVEL_NAMES[rule.threshold] ?? String(rule.threshold);
    return rule.operator === 'eq' ? `${level} 로그` : `${level} ${OPERATOR_WORDS[rule.operator] ?? rule.operator}`;
  }
  const metric = metricLabel(rule.metric);
  const value = thresholdValue(rule);
  const word = OPERATOR_WORDS[rule.operator];
  if (word) return `${metric} ${value} ${word}`;
  return `${metric} ${OPERATOR_SYMBOLS[rule.operator] ?? rule.operator} ${value}`;
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}시간`;
  }
  return `${minutes}분`;
}

function formatSeconds(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return `${seconds / 3600}시간`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}분`;
  }
  return `${seconds}초`;
}

export function evaluationSummary(rule: AlertRule): string {
  if (rule.metric === 'otel_metric') {
    return '메트릭을 수신할 때마다 평가 · 같은 시리즈는 일정 시간에 한 번만 발송';
  }
  if (rule.type === 'service') {
    return '업타임 체크 결과가 조건에 맞을 때마다 평가';
  }
  if (rule.type === 'log') {
    return '로그/API 이벤트마다 평가';
  }
  if (rule.type === 'request') {
    return `최근 ${formatMinutes(rule.duration)} 구간을 1분마다 평가 · ${formatSeconds(rule.cooldown)} 쿨다운`;
  }
  if (rule.isSystem) {
    return '시스템에서 자동 평가';
  }
  return `${formatMinutes(rule.duration)} 동안 지속 · ${formatSeconds(rule.cooldown)} 쿨다운`;
}

export function compactTrigger(rule: AlertRule): string {
  if (rule.isSystem) {
    return '시스템에서 자동 평가';
  }
  // OTel 메트릭은 단위를 모르므로 붙이지 않는다.
  if (rule.metric === 'otel_metric') {
    return `${rule.metricName || '메트릭'} ${OPERATOR_SYMBOLS[rule.operator] ?? rule.operator} ${rule.threshold} · 수신 즉시`;
  }
  if (rule.type === 'log') {
    return `${conditionExpr(rule)} · 즉시`;
  }
  if (rule.type === 'request') {
    return `${conditionExpr(rule)} · 최근 ${formatMinutes(rule.duration)}`;
  }
  if (rule.type === 'service') {
    return `${conditionExpr(rule)} · ${rule.duration}회 연속`;
  }
  return `${conditionExpr(rule)} · ${formatMinutes(rule.duration)} 지속`;
}

// ─── 발송 이력 ──────────────────────────────────────────────────────────────

// 발송 상태는 StatusLight로 보인다. 라벨은 상태색으로 칠하지 않는다(DESIGN §5.1).
const HISTORY_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  sent: { tone: 'healthy', label: '발송' },
  failed: { tone: 'error', label: '실패' },
  pending: { tone: 'warn', label: '대기' },
};

export function historyStatus(status: string): { tone: StatusTone; label: string } {
  return HISTORY_STATUS[status] ?? { tone: 'idle', label: status };
}
