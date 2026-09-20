import { StatusLight, type StatusTone } from './StatusLight';

export type CollectionStatus = 'collecting' | 'partial' | 'delayed' | 'waiting' | 'not-configured';

// Spectrum의 semantic 변형 매핑: positive=collecting, notice(pending/syncing)=partial·delayed,
// neutral(not started)=waiting·not-configured.
const TONE: Record<CollectionStatus, StatusTone> = {
  collecting: 'healthy',
  partial: 'warn',
  delayed: 'warn',
  waiting: 'idle',
  'not-configured': 'idle',
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
  return <StatusLight tone={TONE[status]} label={LABEL[status]} />;
}
