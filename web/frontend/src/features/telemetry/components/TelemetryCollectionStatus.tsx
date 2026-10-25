import { StatusLight } from '../../../components/common';

export function TelemetryCollectionStatus({ active }: { active: boolean }) {
  return <StatusLight tone={active ? 'healthy' : 'error'} label={active ? '수집 가능' : '중지됨'} />;
}
