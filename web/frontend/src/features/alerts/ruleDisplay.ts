// 규칙 목록(데스크톱 표·카드, 모바일 카드)이 같이 쓰는 표시 규칙.
import { useEffect, useState } from 'react';
import type { AlertTarget } from './alertTarget';
import type { StatusTone } from '../../components/common';
import { api, type AlertRule, type AgentServiceFlat, type ConnectedAgent, type InfrastructureResource, type ObservedService, type UptimeMonitor } from '../../services/api';

/** 규칙 대상의 이름을 찾는 목록들. 헬스체크 규칙의 serviceId는 업타임 모니터일 수 있다. */
export interface TargetNames {
  agentServices: AgentServiceFlat[];
  agents: ConnectedAgent[];
  directServices: ObservedService[];
  infrastructureResources: InfrastructureResource[];
  uptimeMonitors: UptimeMonitor[];
  /** 모든 목록을 받았는가. 하나라도 실패하면 이름이 없어도 지워졌다고 단정하지 않는다. */
  complete: boolean;
}

const EMPTY_NAMES: TargetNames = { agentServices: [], agents: [], directServices: [], infrastructureResources: [], uptimeMonitors: [], complete: false };

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
    ]).then(([agentServices, agents, directServices, infrastructureResources, uptimeMonitors]) => {
      if (!active) return;
      const rows = <T,>(result: PromiseSettledResult<T[] | null | undefined>): T[] => result.status === 'fulfilled' ? result.value ?? [] : [];
      setNames({
        agentServices: rows(agentServices),
        agents: rows(agents),
        directServices: rows(directServices),
        infrastructureResources: rows(infrastructureResources),
        uptimeMonitors: rows(uptimeMonitors),
        complete: [agentServices, agents, directServices, infrastructureResources, uptimeMonitors].every(result => result.status === 'fulfilled'),
      });
    });
    return () => { active = false; };
  }, []);
  return names;
}

// 이름을 찾지 못하면 지워진 대상이다. 이름 목록을 다 받지 못했을 때는 id만 보인다(지워졌는지 모름).
function missingTarget(id: string, names: TargetNames): string {
  return names.complete ? `삭제된 대상 (${id})` : id;
}

export function targetLabel(rule: AlertRule, names: TargetNames): string {
  const { agentServices, agents, directServices, infrastructureResources, uptimeMonitors } = names;
  if (rule.type === 'service' || rule.type === 'log' || rule.type === 'request') {
    if (rule.serviceId) return directServices.find(service => service.id === rule.serviceId)?.name
      ?? uptimeMonitors.find(monitor => monitor.id === rule.serviceId)?.name
      ?? missingTarget(rule.serviceId, names);
    if (rule.agentId && rule.serviceKey) {
      const svc = agentServices.find(s => s.agentId === rule.agentId && s.key === rule.serviceKey);
      return svc ? `${svc.agentName} / ${svc.name}` : missingTarget(rule.serviceKey, names);
    }
    // Request rules can also watch a whole Docker environment (API-created).
    if (rule.type === 'request' && rule.agentId) return agents.find(a => a.id === rule.agentId)?.name ?? missingTarget(rule.agentId, names);
    return rule.type === 'log' ? '전체 로그 서비스' : rule.metric === 'otel_metric' ? '모든 서비스' : '전체 헬스체크';
  }
  if (rule.agentId) return infrastructureResources.find(resource => resource.id === rule.agentId)?.name ?? agents.find(a => a.id === rule.agentId)?.name ?? missingTarget(rule.agentId, names);
  return '전체 인프라';
}

/** 대상 필터 줄의 이름. */
export function alertTargetName(target: AlertTarget, names: TargetNames): string {
  if (target.kind === 'direct') {
    return names.directServices.find(service => service.id === target.serviceId)?.name
      ?? names.uptimeMonitors.find(monitor => monitor.id === target.serviceId)?.name
      ?? missingTarget(target.serviceId, names);
  }
  if (target.kind === 'infrastructure') {
    return names.infrastructureResources.find(resource => resource.id === target.resourceId)?.name ?? missingTarget(target.resourceId, names);
  }
  const service = names.agentServices.find(item => item.agentId === target.agentId && item.key === target.serviceKey);
  return service ? `${service.agentName} / ${service.name}` : missingTarget(target.serviceKey, names);
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
  // 메트릭 규칙은 type이 service지만 헬스체크가 아니다 — metric으로 가른다.
  if (rule.metric === 'otel_metric') return 'metric';
  if (rule.type === 'service') return 'endpoint';
  if (rule.type === 'request') return 'request';
  if (rule.type === 'log') return 'log';
  return 'resource';
}

const CATEGORY_LABELS: Record<Exclude<CategoryKey, 'all'>, string> = {
  endpoint: '헬스체크',
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
    return '헬스체크 결과가 조건에 맞을 때마다 평가';
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
