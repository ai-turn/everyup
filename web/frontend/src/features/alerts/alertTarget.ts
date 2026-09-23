import type { AlertRule } from '../../services/api';

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

export function matchesAlertTarget(rule: AlertRule, target: AlertTarget): boolean {
  if (target.kind === 'direct') return rule.serviceId === target.serviceId;
  if (target.kind === 'infrastructure') return rule.agentId === target.resourceId && !rule.serviceKey;
  return rule.agentId === target.agentId && rule.serviceKey === target.serviceKey;
}
