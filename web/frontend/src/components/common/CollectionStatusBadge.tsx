import { StatusLight, type StatusTone } from './StatusLight';
import { COLLECTION_STATUS_LABEL, type CollectionStatus } from './collectionStatus';

export type { CollectionStatus };

// Spectrum의 semantic 변형 매핑: positive=collecting, notice(pending/syncing)=partial·delayed,
// neutral(not started)=waiting·not-configured.
const TONE: Record<CollectionStatus, StatusTone> = {
  collecting: 'healthy',
  partial: 'warn',
  delayed: 'warn',
  waiting: 'idle',
  'not-configured': 'idle',
};

/** Collection state is deliberately independent from the service health badge. */
export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  return <StatusLight tone={TONE[status]} label={COLLECTION_STATUS_LABEL[status]} />;
}
