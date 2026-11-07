import { useEffect, useMemo, useState } from 'react';
import { api, type ObservedService, type ObservedServiceMetricName } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

export interface MetricServiceRow {
  id: string;
  name: string;
  active: boolean;
  metricNames: string[];
  metrics: ObservedServiceMetricName[];
  lastMetricAt?: string;
  lastReceivedAt?: string;
}

export function useMetricServices() {
  const [services, setServices] = useState<ObservedService[]>([]);
  const [catalog, setCatalog] = useState<ObservedServiceMetricName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [checkedAt, setCheckedAt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [loadedServices, loadedCatalog] = await Promise.all([
          api.getObservedServices('metrics'), api.getObservedServiceMetricCatalog(),
        ]);
        if (active) {
          setServices(loadedServices ?? []);
          setCatalog(loadedCatalog ?? []);
          setCheckedAt(Date.now());
        }
      } catch (error) {
        if (active) setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [reloadKey]);

  const rows = useMemo(() => {
    const byService = new Map<string, { names: Set<string>; metrics: ObservedServiceMetricName[]; lastAt?: string; lastReceivedAt?: string }>();
    for (const metric of catalog) {
      const entry = byService.get(metric.serviceId) ?? { names: new Set<string>(), metrics: [] };
      entry.names.add(metric.metricName);
      entry.metrics.push(metric);
      if (!entry.lastAt || Date.parse(metric.lastAt) > Date.parse(entry.lastAt)) entry.lastAt = metric.lastAt;
      if (metric.lastReceivedAt && (!entry.lastReceivedAt || Date.parse(metric.lastReceivedAt) > Date.parse(entry.lastReceivedAt))) entry.lastReceivedAt = metric.lastReceivedAt;
      byService.set(metric.serviceId, entry);
    }
    return services.map((service): MetricServiceRow => ({
      id: service.id, name: service.name, active: service.isActive,
      metricNames: [...(byService.get(service.id)?.names ?? [])].sort((a, b) => a.localeCompare(b)),
      metrics: byService.get(service.id)?.metrics ?? [],
      lastMetricAt: byService.get(service.id)?.lastAt,
      lastReceivedAt: byService.get(service.id)?.lastReceivedAt,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [services, catalog]);

  return { rows, checkedAt, loading, error, reload: () => setReloadKey(key => key + 1) };
}
