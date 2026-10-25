import type { LogPattern, LogServiceSummary } from '../../services/api';

// "지금 이상이 있는가"에 답하는 창 — 보존 기간 전체를 세면 끝난 사고가 계속 빨갛게 남는다.
// /logs/summary·/logs/patterns도 서버에서 같은 24시간을 센다.
const WINDOW_MS = 24 * 60 * 60 * 1000;

// 수집은 Docker 서비스를 에이전트+이름으로, 직접 연결을 id로 묶는다 — 요약·패턴도 같은 키다.
export const logScopeKey = (scope: { serviceId?: string; agentId?: string; serviceName?: string }) =>
  scope.agentId ? `agent:${scope.agentId}:${scope.serviceName}` : `direct:${scope.serviceId}`;

export interface LogServiceRow {
  key: string;
  name: string;
  /** 출처 배지. 한 출처만 보이는 화면에서는 뺀다. */
  connection?: 'direct' | 'docker';
  subtitle?: string;
  /** 직접 연결을 꺼 둔 상태. */
  stopped?: boolean;
  /** 서비스 로그 화면 — 카드가 센 것과 같은 24시간 창으로 연다. */
  to: string;
  summary?: LogServiceSummary;
}

export interface LogPatternRow {
  pattern: LogPattern;
  row: LogServiceRow;
}

/** 요약을 행에 붙이고 문제가 있는 서비스를 앞으로 보낸다. 목록에 없는 서비스의 패턴은 열 곳이 없어 뺀다. */
export function withLogSummaries(baseRows: LogServiceRow[], summaries: LogServiceSummary[], patternRows: LogPattern[]) {
  const summaryByKey = new Map(summaries.map(summary => [logScopeKey(summary), summary]));
  const rows = baseRows.map(row => ({ ...row, summary: summaryByKey.get(row.key) }));
  // 정렬은 안정적이라 같은 건수끼리는 목록 순서를 지킨다.
  rows.sort((a, b) => (b.summary?.error ?? 0) - (a.summary?.error ?? 0) || (b.summary?.warn ?? 0) - (a.summary?.warn ?? 0));
  const rowByKey = new Map(rows.map(row => [row.key, row]));
  const patterns = patternRows.flatMap(pattern => {
    const row = rowByKey.get(logScopeKey(pattern));
    return row ? [{ pattern, row }] : [];
  });
  const now = Date.now();
  return { rows, patterns, span: [now - WINDOW_MS, now] as [number, number] };
}

