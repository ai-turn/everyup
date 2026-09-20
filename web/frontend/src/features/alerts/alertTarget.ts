import type { AlertRule } from '../../services/api';

export type AlertTarget =
  | { kind: 'direct'; serviceId: string }
  | { kind: 'agent'; agentId: string; serviceKey: string };

export function parseAlertTarget(params: URLSearchParams): AlertTarget | null {
  if (params.get('target') === 'direct' && params.get('serviceId')) {
    return { kind: 'direct', serviceId: params.get('serviceId')! };
  }
  if (params.get('target') === 'agent' && params.get('agentId') && params.get('serviceKey')) {
    return { kind: 'agent', agentId: params.get('agentId')!, serviceKey: params.get('serviceKey')! };
  }
  return null;
}

export function alertRulesPath(target: AlertTarget): string {
  const params = new URLSearchParams({ tab: 'rules', target: target.kind });
  if (target.kind === 'direct') params.set('serviceId', target.serviceId);
  else {
    params.set('agentId', target.agentId);
    params.set('serviceKey', target.serviceKey);
  }
  return `/alerts?${params.toString()}`;
}

export function matchesAlertTarget(rule: AlertRule, target: AlertTarget): boolean {
  return target.kind === 'direct'
    ? rule.serviceId === target.serviceId
    : rule.agentId === target.agentId && rule.serviceKey === target.serviceKey;
}
