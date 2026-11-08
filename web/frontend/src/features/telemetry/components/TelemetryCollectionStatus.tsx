import { StatusLight } from '../../../components/common';

export function TelemetryCollectionStatus({ active }: { active: boolean }) {
  return <StatusLight tone={active ? 'healthy' : 'error'} label={active ? '연결 활성' : '중지됨'} />;
}
