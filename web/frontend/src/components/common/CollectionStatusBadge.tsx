
export type CollectionStatus = 'collecting' | 'partial' | 'delayed' | 'waiting' | 'not-configured';

const STYLE: Record<CollectionStatus, string> = {
  collecting: 'border-status-healthy/20 bg-status-healthy/10 text-status-healthy',
  partial: 'border-status-warn/20 bg-status-warn/10 text-status-warn',
  delayed: 'border-status-warn/20 bg-status-warn/10 text-status-warn',
  waiting: 'border-status-idle/20 bg-status-idle/10 text-status-idle',
  'not-configured': 'border-status-idle/20 bg-status-idle/10 text-status-idle',
};

const LABEL: Record<CollectionStatus, string> = {
  collecting: '수집 중',
  partial: '부분 수집',
  delayed: '수집 지연',
  waiting: '수신 대기',
  'not-configured': '미설정',
};

/** Collection state is deliberately independent from the service health badge. */
export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  return <span className={`badge ${STYLE[status]}`}>{LABEL[status]}</span>;
}
