import { CollectionStatusBadge, StatusLight } from '../../../components/common';

export function TelemetryCollectionStatus({ connection, active }: { connection: 'direct' | 'docker'; active: boolean }) {
  return connection === 'direct'
    ? <StatusLight tone={active ? 'healthy' : 'error'} label={active ? '수집 가능' : '중지됨'} />
    : <CollectionStatusBadge status={active ? 'collecting' : 'delayed'} />;
}
