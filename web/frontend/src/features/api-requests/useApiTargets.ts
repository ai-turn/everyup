import { useEffect, useRef, useState } from 'react';
import type { CollectionStatus } from '../../components/common';
import { api, type ApiRequestStatusSummary, type ObservedService } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { receiptCollection } from '../telemetry/signals';
import type { RequestWindow } from './useRequestQuery';

export interface ApiTarget {
  service: ObservedService;
  summary?: ApiRequestStatusSummary;
  /** traces 수신 기준. 조회 실패면 없음 — 그때는 키 상태만 보인다. */
  collection?: CollectionStatus;
  error?: string;
  loading?: boolean;
}

export function useApiTargets(window: RequestWindow, refreshKey: number) {
  const [rows, setRows] = useState<ApiTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const services = await api.getObservedServices('traces');
        // ponytail: 대상마다 요약·수신 상태 두 번 호출. 대상이 많아지면 목록용 일괄 엔드포인트로 바꾼다.
        const results = await Promise.all(services.map(async (service): Promise<ApiTarget> => {
          const collection = api.getObservedServiceSetupStatus(service.id)
            .then(receipts => receiptCollection(receipts, 'traces'), () => undefined);
          try {
            const summary = await api.getObservedServiceRequestStatusSummary(service.id, window);
            return { service, summary, collection: await collection };
          } catch (error) {
            return { service, error: getErrorMessage(error), collection: await collection };
          }
        }));
        if (active) setRows(results);
      } catch (error) {
        if (active) setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; generation.current += 1; };
  }, [window, refreshKey]);
  const retryTarget = async (id: string) => {
    const version = generation.current;
    setRows(current => current.map(row => row.service.id === id ? { ...row, error: undefined, loading: true } : row));
    try {
      const summary = await api.getObservedServiceRequestStatusSummary(id, window);
      if (generation.current === version) setRows(current => current.map(row => row.service.id === id ? { service: row.service, collection: row.collection, summary } : row));
    } catch (error) {
      if (generation.current === version) setRows(current => current.map(row => row.service.id === id ? { service: row.service, collection: row.collection, error: getErrorMessage(error) } : row));
    }
  };
  return { rows, loading, error, retryTarget };
}
