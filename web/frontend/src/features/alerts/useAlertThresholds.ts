import { useEffect, useState } from 'react';
import { api, type AlertMetric, type AlertRule } from '../../services/api';
import { matchesAlertTarget, type AlertTarget } from './alertTarget';

/**
 * Enabled alert rules aimed at this target for one metric — drawn on its chart
 * as threshold lines. Global rules (no target) are left out: they would draw
 * the same line on every chart without saying where it came from.
 */
export function useAlertThresholds(target: AlertTarget, metric: AlertMetric, metricName?: string): AlertRule[] {
  const [rules, setRules] = useState<AlertRule[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.getAlertRules()
      .then((all) => { if (!cancelled) setRules(all ?? []); })
      .catch(() => {}); // Non-critical: the chart simply shows no threshold.
    return () => { cancelled = true; };
  }, []);

  return rules.filter((rule) =>
    rule.isEnabled
    && rule.metric === metric
    && (metricName === undefined || rule.metricName === metricName)
    && matchesAlertTarget(rule, target));
}
