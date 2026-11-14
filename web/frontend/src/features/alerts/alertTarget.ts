import type { AlertRule } from '../../services/api';
import type { AlertRuleFormInitial } from './components/AlertRuleForm';

export type AlertTarget =
  | { kind: 'direct'; serviceId: string }
  | { kind: 'agent'; agentId: string; serviceKey: string }
  // 인프라 규칙은 리소스 id를 agentId에 담고 serviceKey를 비운다 (AlertRuleForm 인프라 대상 셀렉트).
  | { kind: 'infrastructure'; resourceId: string };

export function parseAlertTarget(params: URLSearchParams): AlertTarget | null {
  if (params.get('target') === 'direct' && params.get('serviceId')) {
    return { kind: 'direct', serviceId: params.get('serviceId')! };
  }
  if (params.get('target') === 'agent' && params.get('agentId') && params.get('serviceKey')) {
    return { kind: 'agent', agentId: params.get('agentId')!, serviceKey: params.get('serviceKey')! };
  }
  if (params.get('target') === 'infrastructure' && params.get('resourceId')) {
    return { kind: 'infrastructure', resourceId: params.get('resourceId')! };
  }
  return null;
}

export function alertRulesPath(target: AlertTarget): string {
  const params = new URLSearchParams({ tab: 'rules', target: target.kind });
  if (target.kind === 'direct') params.set('serviceId', target.serviceId);
  else if (target.kind === 'infrastructure') params.set('resourceId', target.resourceId);
  else {
    params.set('agentId', target.agentId);
    params.set('serviceKey', target.serviceKey);
  }
  return `/alerts?${params.toString()}`;
}

/** 대상 필터가 걸린 목록에서 `추가`할 때 폼에 넘길 대상(A-09). 직접 연결 서비스의 카테고리는 폼이 서비스 신호를 보고 고른다. */
export function alertTargetInitial(target: AlertTarget | null): AlertRuleFormInitial {
  if (!target) return {};
  if (target.kind === 'infrastructure') return { ruleCategory: 'resource', agentId: target.resourceId };
  if (target.kind === 'agent') return { agentId: target.agentId, serviceKey: target.serviceKey };
  return { serviceId: target.serviceId };
}

/** 규칙 폼을 미리 채워 여는 링크. AlertsPage가 `new`·`metricName`을 읽어 폼을 연 뒤 URL에서 지운다. */
export function alertRuleNewPath(target: AlertTarget, initial: { category: 'metric'; metricName: string }): string {
  const params = new URLSearchParams(alertRulesPath(target).split('?')[1]);
  params.set('new', initial.category);
  params.set('metricName', initial.metricName);
  return `/alerts?${params.toString()}`;
}

export function matchesAlertTarget(rule: AlertRule, target: AlertTarget): boolean {
  if (target.kind === 'direct') return rule.serviceId === target.serviceId;
  if (target.kind === 'infrastructure') return rule.agentId === target.resourceId && !rule.serviceKey;
  return rule.agentId === target.agentId && rule.serviceKey === target.serviceKey;
}
