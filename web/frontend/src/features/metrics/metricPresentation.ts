import type { StatusTone } from '../../components/common';
import type { OtelMetricName } from '../../services/api';

export const metricIdentity = (metric: OtelMetricName) => JSON.stringify([metric.metricName, metric.metricType, metric.unit ?? '']);

const TITLES: Record<string, string> = {
  'http.server.request.duration': '응답 시간',
  'http.server.duration': '응답 시간',
  'http.server.active_requests': '처리 중인 요청',
  'http.server.active_requests.count': '처리 중인 요청',
  'jvm.memory.used': 'JVM 메모리 사용량',
  'process.memory.usage': '프로세스 메모리 사용량',
  'messaging.process.duration': '메시지 처리 시간',
  'queue.messages.pending': '대기 중인 메시지',
  'billing.jobs.completed': '완료된 작업',
};

export const metricTitle = (metric: OtelMetricName) => TITLES[metric.metricName] ?? metric.metricName;

export function metricGroup(metric: OtelMetricName) {
  if (/^(http|rpc)\./.test(metric.metricName)) return '요청과 응답';
  if (/^(messaging|queue|billing)\./.test(metric.metricName)) return '작업과 메시지';
  if (/^(jvm|process|runtime|go|dotnet|system)\./.test(metric.metricName)) return '런타임과 리소스';
  return '사용자 정의 지표';
}

export interface MetricStatus { tone: StatusTone; label: string }

export function metricCollection(active: boolean, receivedAt?: string, measuredAt?: string, now = Date.now()): MetricStatus {
  if (!active) return { tone: 'idle', label: '수집 중지' };
  if (!receivedAt) return { tone: 'idle', label: measuredAt ? '수신 시각 미확인' : '수신 대기' };
  if (now - Date.parse(receivedAt) > 300_000) return { tone: 'warn', label: '5분 이상 수신 없음' };
  if (measuredAt && Date.parse(measuredAt) > now + 60_000) return { tone: 'warn', label: '측정 시각 확인 필요' };
  if (measuredAt && now - Date.parse(measuredAt) > 300_000) return { tone: 'warn', label: '측정 지연' };
  return { tone: 'healthy', label: '수집 중' };
}

export function metricFlags(metric: OtelMetricName, now = Date.now()): MetricStatus[] {
  const flags: MetricStatus[] = [];
  if (metric.conflicting) flags.push({ tone: 'warn', label: '타입·단위 충돌' });
  if (metric.breached) flags.push({ tone: 'error', label: '임계값 초과' });
  const collection = metricCollection(true, metric.lastReceivedAt, metric.lastAt, now);
  if (collection.tone !== 'healthy') flags.push(collection);
  return flags;
}
