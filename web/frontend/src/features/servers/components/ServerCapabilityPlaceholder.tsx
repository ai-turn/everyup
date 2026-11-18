import { LoadErrorBanner } from '../../../components/common';
import type { ServerCapability } from '../serverPaths';
import { capabilityTargets, type ServerCapabilityTabProps } from '../serverStatus';

// 기능 탭의 임시 본문. 이후 작업이 탭마다 실제 패널로 바꾼다.
export function ServerCapabilityPlaceholder({ row, capability, unknown, onRetry }: ServerCapabilityTabProps & { capability: ServerCapability }) {
  if (unknown) return <LoadErrorBanner inline title="이 기능의 정보를 불러오지 못했습니다" onRetry={onRetry} />;
  const targets = capabilityTargets(row.targets, capability);
  return (
    <div className="space-y-3 type-body text-text-muted">
      {targets.length === 0 ? <p>연결된 대상이 없습니다</p> : (
        <ul className="space-y-1 text-text-base">{targets.map((target) => <li key={target.id}>{target.name}</li>)}</ul>
      )}
      <p>이 탭은 준비 중입니다</p>
    </div>
  );
}
